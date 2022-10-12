// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./curve/ICurveFi.sol";
import "./utils/Withdrawable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SwapCurveV1 is Ownable, Withdrawable {
    ICurveFi public pool3;
    using SafeERC20 for IERC20;

    constructor(){
        pool3 = ICurveFi(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    }

    function balanceOfToken(address _tokenAddress) public view returns(uint) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    /**
     * Exchange DAI by USDC on curve
     */
    function exchangeDAIByUSDC(uint128 _indexTokenIn, uint128 _indexTokenOut, uint256 _amountIn, uint256 _minAmountOut) public onlyOwner returns (uint256) {
        
        //verify if it has the initial amount of DAI
        address tokenInAddr = pool3.coins(_indexTokenIn);
        uint256 contractTokenInBalance = balanceOfToken(tokenInAddr); 
        require(contractTokenInBalance >= _amountIn, "_amountIn is bigger than first token contract balance");
        
        //realize swap
        IERC20(tokenInAddr).safeApprove(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7, _amountIn);
        pool3.exchange(0, 1, _amountIn, 1);

        //get new amount of swaped token
        address tokenOutAddr = pool3.coins(_indexTokenOut);
        uint256 tokenOutBalance = balanceOfToken(tokenOutAddr);
        return tokenOutBalance;
    }

    receive() payable external {}


}