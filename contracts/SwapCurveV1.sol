// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./curve/ICurveFi.sol";
import "./utils/Withdrawable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SwapCurveV1 is Ownable, Withdrawable {
    mapping(address => int128) stableCoinsPool3;
    ICurveFi public pool3;
    using SafeERC20 for IERC20;
    event LoggerSwap( address tokenIn, uint tokenInOldBalance, uint tokenInNewBalance, address tokenOut, uint tokenOutOldBalance, uint tokenOutNewBalance);

    constructor(){
        //DAI, USDC and USDT pool Ethereum Mainnet
        pool3 = ICurveFi(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
        
        //sets DAI, USDC and USDT addresses
        stableCoinsPool3[0x6B175474E89094C44Da98b954EedeAC495271d0F] = 0;
        stableCoinsPool3[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = 1;
        stableCoinsPool3[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 2;        
    }

    function balanceOfToken(address _tokenAddress) public view returns(uint) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    
    /**
     * Execute a single swap on curve
     */
    function exchangeOnCurveV1(uint _amountTokenIn, address _tokenIn, address _tokenOut, address _exchangeRouter) public onlyOwner {
        
        //verify if it has the initial amount of tokenIn
        uint256 contractTokenInBalance = balanceOfToken(_tokenIn); 
        require(contractTokenInBalance >= _amountTokenIn, "_amountIn is bigger than first token contract balance");
        uint256 contractTokenOutOldBalance = balanceOfToken(_tokenOut); 

        //sets pool address and index of tokens
        ICurveFi curvePool = ICurveFi(_exchangeRouter);
        int128 tokenInIndex = stableCoinsPool3[_tokenIn];
        int128 tokenOutIndex = stableCoinsPool3[_tokenOut];
        
        //approve and swap
        IERC20(_tokenIn).safeApprove(_exchangeRouter, _amountTokenIn);
        curvePool.exchange(tokenInIndex, tokenOutIndex, _amountTokenIn, 1);

        //get new amounts
        uint256 tokenInNewBalance = balanceOfToken(_tokenIn);
        uint256 tokenOutNewBalance = balanceOfToken(_tokenOut);
        
        emit LoggerSwap(_tokenIn, contractTokenInBalance, tokenInNewBalance, _tokenOut, contractTokenOutOldBalance, tokenOutNewBalance);
    }

    /**
     * Execute a single swap on curve
     */
    function amountOutOnCurveV1(uint _amountTokenIn, address _tokenIn, address _tokenOut, address _exchangeRouter) public view returns (uint256) {
        
        //verify if it has the initial amount of tokenIn
        uint256 contractTokenInBalance = balanceOfToken(_tokenIn); 
        require(contractTokenInBalance >= _amountTokenIn, "_amountIn is bigger than first token contract balance");
        
        //sets pool address and index of tokens
        ICurveFi curvePool = ICurveFi(_exchangeRouter);
        int128 tokenInIndex = stableCoinsPool3[_tokenIn];
        int128 tokenOutIndex = stableCoinsPool3[_tokenOut];
        
        //approve and swap
        uint tokenAmountOut = curvePool.get_dy(tokenInIndex, tokenOutIndex, _amountTokenIn);

        return tokenAmountOut;
    }

    receive() payable external {}


}