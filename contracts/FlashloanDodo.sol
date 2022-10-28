// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./curve/ICurveFi.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./AddressCoderLib.sol";
import "./dodo/DodoBase.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./utils/Withdrawable.sol";

contract FlashloanDodo is DodoBase, Withdrawable {
    enum SwapMode{ UNISWAP_V2, CURVE_V1}
    mapping(address => SwapMode) routerSwapModes;
    mapping(address => int128) stableCoinsPool3; //used by curve swaps
    address flashLoanPool;

    using SafeERC20 for IERC20;
    event LoggerNewAllowance(uint increasedAmount, address token, address router);


    event LoggerExecuteOperation( address _reserve,
        uint256 currentBalance,
        uint256 _amount);
    event LoggerFlashloan( address _reserve,
        uint256 currentBalance,
        uint256 _amount);
    event LoggerBalance( address _reserve,
        uint256 oldBalance,
        uint256 newBalance);
    
    struct LoggerSwapStruct {
        address exchangeRouter;
        SwapMode swapMode; 
        address tokenIn; 
        uint tokenInOldBalance;
        uint tokenInNewBalance; 
        address tokenOut; 
        uint tokenOutOldBalance; 
        uint tokenOutNewBalance; 
        uint amountTokenIn; 
        uint amountTokenOut;
    }  

    event LoggerSwapNew( LoggerSwapStruct loggerSwapStruct);
    
    
    constructor()  {

        //curve pool3 = CurveV1
        routerSwapModes[0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7] = SwapMode.CURVE_V1;
        //uniswap router = UniswapV2
        routerSwapModes[0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D] = SwapMode.UNISWAP_V2;
        //sushi router = UniswapV2
        routerSwapModes[0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F] = SwapMode.UNISWAP_V2;

        //sets DAI, USDC and USDT addresses on ethereum mainnet
        stableCoinsPool3[0x6B175474E89094C44Da98b954EedeAC495271d0F] = 0;
        stableCoinsPool3[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = 1;
        stableCoinsPool3[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 2;   

        //ethereum DODO stable pool DAI and USDT
        flashLoanPool = 0x3058EF90929cb8180174D74C507176ccA6835D73;
    }

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function _flashLoanCallBack(
        address ,//first parameter is this contract  
        uint256 baseAmount,
        uint256 quoteAmount,
        bytes calldata data
    ) internal override {

        //get amount borrowed        
        uint256 _amount = baseAmount + quoteAmount;
        
        //unpack addressesss array containning exchange routes, in tokens and out tokens 
        address[] memory addressessArray = AddressCoder.decodeAddressArray(data);

        //get address of the token borrowed
        address tokenBorrowed = addressessArray[1];

        //get current balance of token borrowed
        uint256 currentBalance = balanceOfToken(tokenBorrowed);
        
        emit LoggerExecuteOperation(tokenBorrowed, currentBalance, _amount);
        require(_amount <= currentBalance, "Invalid balance, was the flashLoan successful?");

        uint amountIn = _amount;
        uint lastAmount = 0;
        for(uint i = 0; i <= addressessArray.length-3; i += 3){
            address exchangeRouter = addressessArray[i];
            address tokenIn = addressessArray[i+1];
            address tokenOut = addressessArray[i+2];
            SwapMode swapMode = routerSwapModes[exchangeRouter];

            //vefiry swap mode and calls swap function accordly
            if(swapMode == SwapMode.CURVE_V1){
                lastAmount = singleSwapOnPool3CurveV1(amountIn, tokenIn, tokenOut, exchangeRouter);
            } else if (swapMode == SwapMode.UNISWAP_V2){
                lastAmount = singleSwapOnUniswapV2(amountIn, tokenIn, tokenOut, exchangeRouter);
            } 
            amountIn = lastAmount;
        }
        
        //Return funds
        IERC20(tokenBorrowed).transfer(flashLoanPool, _amount);
    }

    /**
     * Flashloan main function on AAVE
     */
    function flashloanDodo(uint _amountInitialIn, address[] memory _addrArr) public onlyOwner {
        
        require(_addrArr.length % 3 == 0, "Error: not a valid amount of address, array size must be multiple of 3");
        bytes memory byteAddressess = AddressCoder.encodeAddressArray(_addrArr);

        //take current balance of the first token of the list (0 is router, 1 is from, 2 is to)
        address loanToken = _addrArr[1];
        uint256 currentBalance = balanceOfToken(loanToken);
        emit LoggerFlashloan(_addrArr[1], currentBalance, _amountInitialIn);

        
        IDODO(flashLoanPool).flashLoan(
            IDODO(flashLoanPool)._BASE_TOKEN_() == loanToken
                ? _amountInitialIn
                : 0,
            IDODO(flashLoanPool)._BASE_TOKEN_() == loanToken
                ? 0
                : _amountInitialIn,
            address(this),
            byteAddressess
        );

        //shows new old and new balances of token _asset
        uint256 newBalance = balanceOfToken( _addrArr[1]);
        emit LoggerBalance(_addrArr[1], currentBalance, newBalance);
    }



    /**
     * Function to be called by executeOperation (callback flashloan function)
     */
    function multipleSwapsUniswapV2(uint _amountInitialIn, address[] memory _addressessArray) 
        internal
        returns (uint)    {
        
        //make sure current balance is superior than the first token amount
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
                emit LoggerNewAllowance(amountIn - currentAllowance, path[0], _addressessArray[i]);
                IERC20(path[0]).safeIncreaseAllowance(_addressessArray[i], amountIn - currentAllowance);
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

    /**
     * Execute a single swap on Uniswap V2 type exchanges
     */
    function singleSwapOnUniswapV2(uint _amountTokenIn, address _tokenIn, address _tokenOut, address _exchangeRouter) 
        internal
        returns (uint)    {
        LoggerSwapStruct memory loggerSwapStruct;
        loggerSwapStruct.tokenInOldBalance = balanceOfToken(_tokenIn); 
        
        //make sure current balance is superior than the first token amount
        require(loggerSwapStruct.tokenInOldBalance >= _amountTokenIn, "AmountInitialIn is bigger than first token contract balance");
        loggerSwapStruct.swapMode = SwapMode.UNISWAP_V2;
        loggerSwapStruct.exchangeRouter = _exchangeRouter;
        loggerSwapStruct.tokenOutOldBalance = balanceOfToken(_tokenOut); 
        loggerSwapStruct.tokenIn = _tokenIn;
        loggerSwapStruct.tokenOut = _tokenOut;
        loggerSwapStruct.amountTokenIn = _amountTokenIn;

        //check allowance
        setAllowance(_amountTokenIn, _tokenIn, _exchangeRouter); 

        //set variables and execute swap
        IUniswapV2Router02 currentRouter = IUniswapV2Router02(_exchangeRouter);
        address[] memory path;
        path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;
        uint[] memory amounts = currentRouter.swapExactTokensForTokens(
            _amountTokenIn,
            1,
            path,
            address(this),
            block.timestamp
        ); 

        //get amount out
        loggerSwapStruct.amountTokenOut = amounts[1];

        //get new balances and emit event
        loggerSwapStruct.tokenInNewBalance = balanceOfToken(_tokenIn);
        loggerSwapStruct.tokenOutNewBalance = balanceOfToken(_tokenOut);        
        emit LoggerSwapNew(loggerSwapStruct);
        
        return loggerSwapStruct.amountTokenOut;
    }

     /**
     * Execute a single swap on curve V1 type exchanges
     */
    function singleSwapOnPool3CurveV1(uint _amountTokenIn, address _tokenIn, address _tokenOut, address _exchangeRouter) 
    internal
    returns (uint)    {    
        LoggerSwapStruct memory loggerSwapStruct;
        //verify if it has the initial amount of tokenIn
        loggerSwapStruct.tokenInOldBalance = balanceOfToken(_tokenIn); 
        require(loggerSwapStruct.tokenInOldBalance >= _amountTokenIn, "_amountIn is bigger than first token contract balance");
        loggerSwapStruct.swapMode = SwapMode.CURVE_V1;
        loggerSwapStruct.exchangeRouter = _exchangeRouter;
        loggerSwapStruct.tokenOutOldBalance = balanceOfToken(_tokenOut); 
        loggerSwapStruct.tokenIn = _tokenIn;
        loggerSwapStruct.tokenOut = _tokenOut;
        loggerSwapStruct.amountTokenIn = _amountTokenIn;

        //sets pool address and index of tokens
        ICurveFi curvePool = ICurveFi(_exchangeRouter);
        
        //check allowance
        setAllowance(_amountTokenIn, _tokenIn, _exchangeRouter); 

        //execute swap
        curvePool.exchange(stableCoinsPool3[_tokenIn], stableCoinsPool3[_tokenOut], _amountTokenIn, 1);

        //get new amounts
        loggerSwapStruct.tokenInNewBalance = balanceOfToken(_tokenIn);
        loggerSwapStruct.tokenOutNewBalance = balanceOfToken(_tokenOut);
        loggerSwapStruct.amountTokenOut = loggerSwapStruct.tokenOutNewBalance - loggerSwapStruct.tokenOutOldBalance;
        emit LoggerSwapNew(loggerSwapStruct);
        
        return loggerSwapStruct.amountTokenOut;
    }

    function setAllowance(uint _amountTokenIn, address _tokenIn, address _exchangeRouter)
    internal
    {
        uint currentAllowance = checkAllowance(_tokenIn, _exchangeRouter);
        if(currentAllowance < _amountTokenIn){
            emit LoggerNewAllowance(_amountTokenIn - currentAllowance, _tokenIn, _exchangeRouter);
            IERC20(_tokenIn).safeIncreaseAllowance(_exchangeRouter, _amountTokenIn - currentAllowance);
        }  
    }

    //returns the balance of a given token 
    function balanceOfToken(address _tokenAddress) public view returns(uint) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    
    function checkAllowance (address _tokenAddress, address _routerAddress) public view returns(uint){
        return IERC20(_tokenAddress).allowance(address(this), _routerAddress);
    }

    
}
