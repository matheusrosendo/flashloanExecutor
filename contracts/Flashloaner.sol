// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ICurveFi} from "./curve/ICurveFi.sol";
import {IUniswapV2Router02} from  "./uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {AddressCoder} from "./AddressCoderLib.sol";
import {DodoBase, IFlashloan, IDODO, RouteUtils} from "./dodo/DodoBase.sol";
import {ISwapRouter} from "./uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IUniswapV3Pool} from "./uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {Withdrawable, SafeERC20, IERC20} from "./utils/Withdrawable.sol";   
import {FlashLoanReceiverBase, ILendingPoolAddressesProvider, ILendingPool} from "./aave/protocol-v2/contracts/flashloan/base/FlashLoanReceiverBase.sol";


contract Flashloaner is DodoBase, Withdrawable, FlashLoanReceiverBase {
    uint testInputCall;
    enum ProtocolType{ UNISWAP_V2, CURVE_V1, UNISWAP_V3}
    mapping(uint8 => ProtocolType) protocolTypes;
    mapping(address => int128) stableCoinsPool3; //used by curve swaps only

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
        ProtocolType protocolType; 
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
    
    //address passed is Aave Pool Provider V2 
    constructor() FlashLoanReceiverBase(ILendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5)) {
        testInputCall = 0;
        //set protocol types
        protocolTypes[1] = ProtocolType.CURVE_V1;
        protocolTypes[2] = ProtocolType.UNISWAP_V2;
        protocolTypes[3] = ProtocolType.UNISWAP_V3;

        //sets DAI, USDC and USDT addresses on ethereum mainnet
        stableCoinsPool3[0x6B175474E89094C44Da98b954EedeAC495271d0F] = 0;
        stableCoinsPool3[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = 1;
        stableCoinsPool3[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 2;   
    }

    function iterate() public {
        emit LoggerBalance(0x6B175474E89094C44Da98b954EedeAC495271d0F, 900, 1000);
        testInputCall++;

    }

    function getCounter() public view returns(uint){
        return testInputCall;
    } 

    /**
     * Flashloan main function 
     */
    function flashloanDodo(FlashInputData memory _flashloanInputData) public onlyOwner checkInputData(_flashloanInputData) {
        
        bytes memory flashData = abi.encode(FlashInputData(
            {
                flashLoanPool: _flashloanInputData.flashLoanPool,
                loanAmount: _flashloanInputData.loanAmount,
                swaps: _flashloanInputData.swaps
            }
        ));

        //take current balance of the first token of the list (0 is router, 1 is from, 2 is to)
        address loanToken = RouteUtils.getInitialToken(_flashloanInputData);
        
        uint256 currentBalance = balanceOfToken(loanToken);
        //emit LoggerFlashloan(loanToken, currentBalance, _flashloanInputData.loanAmount);

        
        IDODO(_flashloanInputData.flashLoanPool).flashLoan(
            IDODO(_flashloanInputData.flashLoanPool)._BASE_TOKEN_() == loanToken
                ? _flashloanInputData.loanAmount
                : 0,
            IDODO(_flashloanInputData.flashLoanPool)._BASE_TOKEN_() == loanToken
                ? 0
                : _flashloanInputData.loanAmount,
            address(this),
            flashData
        );

        //shows new old and new balances of token _asset
        uint256 newBalance = balanceOfToken(loanToken);
        emit LoggerBalance(loanToken, currentBalance, newBalance);
    }



    /**
        Callback function from DODO flashloan. This function is called after your contract has received the flash loaned amount
     */
    function _flashLoanCallBack(
        address ,//first parameter is this contract  
        uint256 baseAmount,
        uint256 quoteAmount,
        bytes calldata data
    ) internal override {

        //get amount borrowed (one will be 0)       
        uint256 loanAmount = baseAmount + quoteAmount;
        
        //unpack input data
        FlashInputData memory decodedInputData = abi.decode(
            data,
            (FlashInputData)
        );

        //get address of the token borrowed
        address loanToken = RouteUtils.getInitialToken(decodedInputData);

        //get current balance of token borrowed
        uint256 currentBalance = balanceOfToken(loanToken);
        
        //emit LoggerExecuteOperation(loanToken, currentBalance, loanAmount);
        require(loanAmount <= currentBalance, "Invalid balance, was the flashLoan successful?");

        uint amountIn = loanAmount;
        uint lastAmount = 0;
        for(uint i = 0; i < decodedInputData.swaps.length; i++){
            
            address exchangeRouter = decodedInputData.swaps[i].routerAddress;
            address tokenIn = decodedInputData.swaps[i].tokenInAddress;
            address tokenOut = decodedInputData.swaps[i].tokenOutAddress;
            uint24 fee = decodedInputData.swaps[i].fee;
            ProtocolType protocolType = protocolTypes[decodedInputData.swaps[i].protocolTypeIndex];

            //vefiry swap mode and calls swap function accordly
            if(protocolType == ProtocolType.CURVE_V1){
                lastAmount = singleSwapOnPool3CurveV1(amountIn, tokenIn, tokenOut, exchangeRouter);
            } else if (protocolType == ProtocolType.UNISWAP_V2){
                lastAmount = singleSwapOnUniswapV2(amountIn, tokenIn, tokenOut, exchangeRouter);
            } else if (protocolType == ProtocolType.UNISWAP_V3){
                lastAmount = singleSwapOnUniswapV3(amountIn, tokenIn, tokenOut, exchangeRouter, fee);
            } 
            amountIn = lastAmount;
        }
        
        //Return funds
        IERC20(loanToken).transfer(decodedInputData.flashLoanPool, loanAmount);
    }

    /**
     * AAVE Flashloan main function
     */
    function flashloanAave(FlashInputData memory _flashloanInputData) public {
        bytes memory flashData = abi.encode(FlashInputData(
            {
                flashLoanPool: _flashloanInputData.flashLoanPool,
                loanAmount: _flashloanInputData.loanAmount,
                swaps: _flashloanInputData.swaps
            }
        ));
        
        address receiverAddress = address(this);

        address[] memory assets = new address[](1);
        assets[0] = RouteUtils.getInitialToken(_flashloanInputData);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _flashloanInputData.loanAmount;

        // 0 = no debt, 1 = stable, 2 = variable
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        address onBehalfOf = address(this);
        uint16 referralCode = 0;

        LENDING_POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            flashData,
            referralCode
        );
    }

    /**
        This function is called after your contract has received the flash loaned amount
     */
     function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata data
    ) external override returns (bool) {

        //unpack input data
        FlashInputData memory decodedInputData = abi.decode(
            data,
            (FlashInputData)
        );
        
        //make sure borowed token is the first one of the route
        require(assets[0] == RouteUtils.getInitialToken(decodedInputData), "Borrowed token is diferent from the initial token!");

        //get amount of the first token borrewed, since aave2 permits more than one token to be borrowed at once
        uint256 currentBalance = balanceOfToken(assets[0]);
        require(amounts[0] <= currentBalance, "Invalid balance, was the flashLoan successful?");

        uint amountIn = amounts[0];
        { // limit variable scope to avoid sStack too deep errors    
             uint lastAmount = 0;
                {  // limit variable scope to avoid sStack too deep errors 
                    for(uint i = 0; i < decodedInputData.swaps.length; i++){
                        
                        ProtocolType protocolType = protocolTypes[decodedInputData.swaps[i].protocolTypeIndex];

                        //vefiry swap mode and calls swap function accordly
                        if(protocolType == ProtocolType.CURVE_V1){
                            lastAmount = singleSwapOnPool3CurveV1(amountIn, decodedInputData.swaps[i].tokenInAddress, decodedInputData.swaps[i].tokenOutAddress, decodedInputData.swaps[i].routerAddress);
                        } else if (protocolType == ProtocolType.UNISWAP_V2){
                            lastAmount = singleSwapOnUniswapV2(amountIn, decodedInputData.swaps[i].tokenInAddress, decodedInputData.swaps[i].tokenOutAddress, decodedInputData.swaps[i].routerAddress);
                        } else if (protocolType == ProtocolType.UNISWAP_V3){
                            lastAmount = singleSwapOnUniswapV3(amountIn, decodedInputData.swaps[i].tokenInAddress, decodedInputData.swaps[i].tokenOutAddress, decodedInputData.swaps[i].routerAddress, decodedInputData.swaps[i].fee);
                        } 
                        amountIn = lastAmount;
                    }
                }
        }


        // Approve the LendingPool contract allowance to *pull* the owed amount
        for (uint256 i = 0; i < assets.length; i++) {
            setAllowance(amounts[i] + premiums[i], assets[i], address(LENDING_POOL));
        }
        return true;
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
                //emit LoggerNewAllowance(amountIn - currentAllowance, path[0], _addressessArray[i]);
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
        loggerSwapStruct.protocolType = ProtocolType.UNISWAP_V2;
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
        //emit LoggerSwapNew(loggerSwapStruct);
        
        return loggerSwapStruct.amountTokenOut;
    }

    /**
     * Execute a single swap on Uniswap V3 type exchanges
     */
    function singleSwapOnUniswapV3(uint _amountTokenIn, address _tokenIn, address _tokenOut, address _exchangeRouter, uint24 _fee) 
        internal
        returns (uint256 amountOut)    {
        LoggerSwapStruct memory loggerSwapStruct;
        loggerSwapStruct.tokenInOldBalance = balanceOfToken(_tokenIn); 
        
        //make sure current balance is superior than the first token amount
        require(loggerSwapStruct.tokenInOldBalance >= _amountTokenIn, "AmountInitialIn is bigger than first token contract balance");
        loggerSwapStruct.protocolType = ProtocolType.UNISWAP_V3;
        loggerSwapStruct.exchangeRouter = _exchangeRouter;
        loggerSwapStruct.tokenOutOldBalance = balanceOfToken(_tokenOut); 
        loggerSwapStruct.tokenIn = _tokenIn;
        loggerSwapStruct.tokenOut = _tokenOut;
        loggerSwapStruct.amountTokenIn = _amountTokenIn;

        //check allowance
        setAllowance(_amountTokenIn, _tokenIn, _exchangeRouter); 
        
        //declare router V3
        ISwapRouter swapRouter = ISwapRouter(_exchangeRouter);

        // perform swap
        amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: _fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amountTokenIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );

        //get amount out
        loggerSwapStruct.amountTokenOut = amountOut;

        //get new balances and emit event
        loggerSwapStruct.tokenInNewBalance = balanceOfToken(_tokenIn);
        loggerSwapStruct.tokenOutNewBalance = balanceOfToken(_tokenOut);        
        emit LoggerSwapNew(loggerSwapStruct);
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
        loggerSwapStruct.protocolType = ProtocolType.CURVE_V1;
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
        //emit LoggerSwapNew(loggerSwapStruct);
        
        return loggerSwapStruct.amountTokenOut;
    }

    function setAllowance(uint _amountTokenIn, address _tokenIn, address _exchangeRouter)
    internal
    {
        uint currentAllowance = checkAllowance(_tokenIn, _exchangeRouter);
        if(currentAllowance < _amountTokenIn){
            //emit LoggerNewAllowance(_amountTokenIn - currentAllowance, _tokenIn, _exchangeRouter);
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
