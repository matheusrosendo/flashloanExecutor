// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AddressCoderLib.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
 
/**
Ethereum Mainnet Address:
Uniswap router = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
Sushiswap router = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F
DAI token = 0x6B175474E89094C44Da98b954EedeAC495271d0F
USDC token = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
USDT token = 0xdAC17F958D2ee523a2206206994597C13D831ec7
WETH token = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
LINK token = 0x514910771AF9Ca656af840dff83E8264EcF986CA
WBTC token = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
*/

contract SwapUniswapV2 is Ownable{
    
    using SafeERC20 for IERC20;
    event SwapLogger(uint AmountInitialIn, address router, address from, address to);
    event NewAllowanceLogger(uint increasedAmount, address token, address router);
    uint public lastIndexProcessed;
    receive() external payable{}

    //returns the balance of a given token 
    function balanceOfToken(address _tokenAddress) public view returns(uint) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    
    function checkAllowance (address _tokenAddress, address _routerAddress) public view returns(uint){
        return IERC20(_tokenAddress).allowance(address(this), _routerAddress);
    }

    function forceApprove(address _tokenAddress, address _routerAddress, uint _amount, uint mode) onlyOwner public returns (uint){
        if(mode == 0){
            IERC20(_tokenAddress).approve(_routerAddress, _amount);
        } else if ( mode == 1){
            IERC20(_tokenAddress).safeApprove(_routerAddress, _amount);
        } else if (mode == 2){
            IERC20(_tokenAddress).safeIncreaseAllowance(_routerAddress, _amount);
        }
        return IERC20(_tokenAddress).allowance(address(this), _routerAddress);
    }


    //withdraw a given token 
    function withdrawToken(address _tokenAddress)  external  onlyOwner {
        IERC20 tokenContract = IERC20(_tokenAddress);
        uint amount = tokenContract.balanceOf(address(this));
        tokenContract.safeTransfer(msg.sender, amount);
    }
    
    //swap a specific amount using the given path in the informed router address. takes whole balance if amountIn is set to 0
    function swapInOneExchange(address _routerAddr, uint _amountIn, address[] memory _pathAddr, bool withdraw) onlyOwner 
        external
        returns (uint amoutnOut) {
        require(_pathAddr.length > 1, "Path address array size must be greater than 1");

        //takes the balance of the first Item of the array
        uint currentTokenBalance = IERC20(_pathAddr[0]).balanceOf(address(this));
        
        //in case of 0 amountIn as parameter takes the whole balancce 
        if(_amountIn == 0){
            _amountIn = currentTokenBalance;
        }

        //verify balances
        require(currentTokenBalance > 0, "Insuficient initial balance of first token of the path");
        require(_amountIn <= currentTokenBalance, "AmountIn is bigger than current token balance");
        IUniswapV2Router02 router = IUniswapV2Router02(_routerAddr);
        
        //set allowance to router
        uint currentAllowance = checkAllowance(_pathAddr[0], _routerAddr);
        if(currentAllowance < _amountIn){
            emit NewAllowanceLogger(_amountIn - currentAllowance, _pathAddr[0], _routerAddr);
            IERC20(_pathAddr[0]).safeIncreaseAllowance(_routerAddr, _amountIn - currentAllowance);
        }

        uint[] memory amounts = router.swapExactTokensForTokens(
            _amountIn,
            1,
            _pathAddr,
            address(this),
            block.timestamp
        );

        //take last token balance and send it back to the sender
        if(withdraw){
            IERC20 tokenContract = IERC20(_pathAddr[_pathAddr.length-1]);
            uint amount = tokenContract.balanceOf(address(this));
            tokenContract.safeTransfer(msg.sender, amount);
        }        

        return amounts[amounts.length-1];
    }

    //main function of swap to be called inside
    function swapExp1(uint _amountInitialIn, address[] memory _router, address[] memory _from, address[] memory _to) onlyOwner
        external
        returns (uint)
    {

        uint contractToken0Balance = IERC20(_from[0]).balanceOf(address(this));
        require(contractToken0Balance >= _amountInitialIn, "AmountInitialIn is bigger than first token contract balance");
        
        uint amountIn = _amountInitialIn;
        uint lastAmount = 0;
        for(uint i = 0; i < _router.length; i++){
            address[] memory path;
            path = new address[](2);
            path[0] = _from[i];
            path[1] = _to[i];
            IUniswapV2Router02 currentRouter = IUniswapV2Router02(_router[i]);
            uint currentAllowance = checkAllowance(_from[i], _router[i]);
            if(currentAllowance < amountIn){
                emit NewAllowanceLogger(amountIn - currentAllowance, _from[i], _router[i]);
                IERC20(_from[i]).safeIncreaseAllowance(_router[i], amountIn - currentAllowance);
            }
            
            uint[] memory amounts = currentRouter.swapExactTokensForTokens(
                amountIn,
                1,
                path,
                address(this),
                block.timestamp
            );
            lastAmount = amounts[1];
            amountIn = lastAmount;
        }        
        return lastAmount;
    }

    //main function of swap to be called inside
    //@_packedAddresses packed bytes of address array, it must be passed in a sequence like this (router0, from0, to0, router1, from1, to1, router2,....)
    function swapInternal(uint _amountInitialIn, bytes memory _packedAddresses) onlyOwner
        internal
        returns (uint)
    {
        //unpack addressesss array containning routes, from tokens, to tokens 
        address[] memory addressessArray = AddressCoder.decodeAddressArray(_packedAddresses);

        uint contractToken0Balance = IERC20(addressessArray[1]).balanceOf(address(this));
        require(contractToken0Balance >= _amountInitialIn, "AmountInitialIn is bigger than first token contract balance");
        
        uint amountIn = _amountInitialIn;
        uint lastAmount = 0;
        for(uint i = 0; i <= addressessArray.length-3; i += 3){
            address[] memory path;
            path = new address[](2);
            path[0] = addressessArray[i+1];
            path[1] = addressessArray[i+2];
            IUniswapV2Router02 currentRouter = IUniswapV2Router02(addressessArray[i]);
            uint currentAllowance = checkAllowance(path[0], addressessArray[i]);
            if(currentAllowance < amountIn){
                emit NewAllowanceLogger(amountIn - currentAllowance, path[0], addressessArray[i]);
                IERC20(path[0]).safeIncreaseAllowance(addressessArray[i], amountIn - currentAllowance);
            }            
            emit SwapLogger(amountIn, addressessArray[i], path[0], path[1]);
            lastIndexProcessed = amountIn;
            uint[] memory amounts = currentRouter.swapExactTokensForTokens(
                amountIn,
                1,
                path,
                address(this),
                block.timestamp
            ); 
            lastAmount = amounts[1];
            amountIn = lastAmount;
        }
        
        return lastAmount;
    }

    //pack address array into a bytes variable, then unpack it and return the first address to test
    function swapExternal(uint _amountInitialIn, address[] memory _addrArr) external returns(uint) {
        require(_addrArr.length % 3 == 0, "Error: not a valid amount of address, array size must be multiple of 3");
        bytes memory byteAddressess = AddressCoder.encodeAddressArray(_addrArr);

        uint resultLastAmount = swapInternal(_amountInitialIn, byteAddressess);
        return resultLastAmount;
    }


    /**
    * Function to be called by executeOperation (callback flashloan function)
     */
    function execute(uint _amountInitialIn, address[] memory _addressessArray) 
        external
        returns (uint)
    {

        uint contractToken0Balance = IERC20(_addressessArray[1]).balanceOf(address(this));
        require(contractToken0Balance >= _amountInitialIn, "AmountInitialIn is bigger than first token contract balance");
        
        uint amountIn = _amountInitialIn;
        uint lastAmount = 0;
        for(uint i = 0; i <= _addressessArray.length-3; i += 3){
            address[] memory path;
            path = new address[](2);
            path[0] = _addressessArray[i+1];
            path[1] = _addressessArray[i+2];
            IUniswapV2Router02 currentRouter = IUniswapV2Router02(_addressessArray[i]);
            uint currentAllowance = checkAllowance(path[0], _addressessArray[i]);
            if(currentAllowance < amountIn){
                emit NewAllowanceLogger(amountIn - currentAllowance, path[0], _addressessArray[i]);
                IERC20(path[0]).safeIncreaseAllowance(_addressessArray[i], amountIn - currentAllowance);
            }            
            emit SwapLogger(amountIn, _addressessArray[i], path[0], path[1]);
            lastIndexProcessed = amountIn;
            uint[] memory amounts = currentRouter.swapExactTokensForTokens(
                amountIn,
                1,
                path,
                address(this),
                block.timestamp
            ); 
            lastAmount = amounts[1];
            amountIn = lastAmount;
        }
        
        return lastAmount;
    }


    function unpackAddress(bytes memory _params) 
        internal pure
        returns (address[] memory)
    {
        
        address[] memory addrArray = AddressCoder.decodeAddressArray(_params);
        
        
        return addrArray;
    }

    //pack address array into a bytes variable, then unpack it and return the first address to test
    function testPackedAddressess(uint indexShow, address[] memory _addrArr) external pure returns(address) {
        
        bytes memory byteAddressess = AddressCoder.encodeAddressArray(_addrArr);

        address[] memory addressArrayUnpacked = unpackAddress(byteAddressess);
        return addressArrayUnpacked[indexShow];
    }
}

