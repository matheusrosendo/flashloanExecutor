// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ICurveFi} from "./curve/ICurveFi.sol";
import {IUniswapV2Router02} from  "./uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {DodoBase, IFlashloan, IDODO, RouteUtils} from "./dodo/DodoBase.sol";
import {AaveBase} from "./aave/AaveBase.sol"; 
import {ISwapRouter} from "./uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IUniswapV3Pool} from "./uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {Withdrawable, SafeERC20, IERC20} from "./utils/Withdrawable.sol";   
import {FlashLoanReceiverBase, ILendingPoolAddressesProvider, ILendingPool} from "./aave/protocol-v2/contracts/flashloan/base/FlashLoanReceiverBase.sol";


contract Flashloaner is DodoBase, AaveBase,  Withdrawable {
    using SafeERC20 for IERC20;
    uint networkId;
    
    enum ProtocolType{ UNISWAP_V2, CURVE_V1, UNISWAP_V3}
    mapping(uint8 => ProtocolType) protocolTypes;
    mapping(address => int128) stableCoinsPool3; //used by curve swaps only
    event LoggerNewAllowance(uint increasedAmount, address token, address router);

    constructor(address[] memory _stablecoins, uint _networkId)  {
        
        //set protocol types
        protocolTypes[1] = ProtocolType.CURVE_V1;
        protocolTypes[2] = ProtocolType.UNISWAP_V2;
        protocolTypes[3] = ProtocolType.UNISWAP_V3;

        //sets DAI, USDC and USDT addresses on ethereum mainnet
        stableCoinsPool3[_stablecoins[0]] = 0;
        stableCoinsPool3[_stablecoins[1]] = 1;
        stableCoinsPool3[_stablecoins[2]] = 2; 

        networkId = _networkId;  
    }


    /**
     * Flashloan main function taking loan from a DODO pool
     */
    function flashloanDodo(FlashInputData memory _flashloanInputData) public onlyOwner checkInputData(_flashloanInputData) {
        
        //encode data received to pass by parameter as bytes to the flashloan function of DODO pool 
        bytes memory flashData = abi.encode(FlashInputData(
            {
                flashLoanPool: _flashloanInputData.flashLoanPool,
                loanAmount: _flashloanInputData.loanAmount,
                swaps: _flashloanInputData.swaps
            }
        ));

        //take current balance of the first token of the list (0 is router, 1 is from, 2 is to)
        address loanToken = RouteUtils.getInitialToken(_flashloanInputData);        
        
        
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

        //send profit back to the caller
        IERC20(loanToken).safeTransfer(msg.sender, balanceOfToken(loanToken));
    }


    /**
        Callback function from DODO flashloan. This function is called after your contract has received the flash loaned amount
     */
    function _flashLoanCallBackDodo( 
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

        uint256 newBalance = balanceOfToken(loanToken);
        require(newBalance > currentBalance, "Borrowed balance bigger than new balance after swaps. No profit found!");
        
        //Return funds
        IERC20(loanToken).safeTransfer(decodedInputData.flashLoanPool, loanAmount);
    }

    /**
     * AAVE Flashloan main function
     */
    function flashloanAave(FlashInputData memory _flashloanInputData) public onlyOwner {
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

        //instantiate AAVE lending pool
        ILendingPool lendingPool = ILendingPool(_flashloanInputData.flashLoanPool);

        //calls flashloan function
        lendingPool.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            flashData,
            referralCode
        );

        //send profit back to the caller
        IERC20(assets[0]).safeTransfer(msg.sender, balanceOfToken(assets[0]));
    }


    /**
        This function is called after your contract has received the flash loaned amount
     */
     function _flashloanCallbackAave(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        bytes calldata data
    ) internal override returns (bool) { 

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

        uint256 newBalance = balanceOfToken(assets[0]);
        require(newBalance > currentBalance, "Borrowed balance bigger than new balance after swaps. No profit found!");

        // Approve the LendingPool contract allowance to *pull* the owed amount
        for (uint256 i = 0; i < assets.length; i++) {
            setAllowance(amounts[i] + premiums[i], assets[i], decodedInputData.flashLoanPool);
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
        
        //make sure current balance is superior than the first token amount
        uint256 currentTokenInBalance = balanceOfToken(_tokenIn); 
        require(currentTokenInBalance >= _amountTokenIn, "AmountInitialIn is bigger than first token contract balance");
       
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
        
        //returns amountOut
        return amounts[1];
    }

    /**
     * Execute a single swap on Uniswap V3 type exchanges
     */
    function singleSwapOnUniswapV3(uint _amountTokenIn, address _tokenIn, address _tokenOut, address _exchangeRouter, uint24 _fee) 
        internal
        returns (uint256 amountOut)    {
       
        //make sure current balance is superior than the first token amount
        uint256 currentBalanceTokenIn = balanceOfToken(_tokenIn); 
        require(currentBalanceTokenIn >= _amountTokenIn, "AmountInitialIn is bigger than first token contract balance");
        
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

        return amountOut;
    }

     /**
     * Execute a single swap on curve V1 type exchanges
     */
    function singleSwapOnPool3CurveV1(uint _amountTokenIn, address _tokenIn, address _tokenOut, address _exchangeRouter) 
    internal
    returns (uint)    {    
        
        //make sure current balance is superior than the first token amount
        uint256 currentBalanceTokenIn = balanceOfToken(_tokenIn); 
        require(currentBalanceTokenIn >= _amountTokenIn, "_amountIn is bigger than first token contract balance");

        //gets old balance of token out to compare later with the new balance
        uint tokenOutOldBalance = balanceOfToken(_tokenOut);

        //sets pool address and index of tokens
        ICurveFi curvePool = ICurveFi(_exchangeRouter);
        
        //check allowance
        setAllowance(_amountTokenIn, _tokenIn, _exchangeRouter); 

        //execute swap, Polygon uses exchange_underlying, while Ethereum uses exchange
        if(networkId == 1){
            curvePool.exchange(stableCoinsPool3[_tokenIn], stableCoinsPool3[_tokenOut], _amountTokenIn, 1);
        } else {
            curvePool.exchange_underlying(stableCoinsPool3[_tokenIn], stableCoinsPool3[_tokenOut], _amountTokenIn, 1);
        }
        

        //calculate and return amount out
        uint tokenOutNewBalance = balanceOfToken(_tokenOut); 
        uint amountOut = tokenOutNewBalance - tokenOutOldBalance;
        return amountOut;
    }

    /**
     * Approve allowance if it is not set yet or increases the current allowance
     */
    function setAllowance(uint _amountTokenIn, address _tokenIn, address _exchangeRouter)
    internal
    {
        require(_amountTokenIn > 0, "setAllowance method called passing 0 or negative value as _amountTokenIn");
        uint currentAllowance = checkAllowance(_tokenIn, _exchangeRouter);
        if(currentAllowance == 0){
            IERC20(_tokenIn).safeApprove(_exchangeRouter, _amountTokenIn);
            emit LoggerNewAllowance(_amountTokenIn, _tokenIn, _exchangeRouter);
        } else {
            if(currentAllowance < _amountTokenIn){
                IERC20(_tokenIn).safeIncreaseAllowance(_exchangeRouter, _amountTokenIn - currentAllowance);
                emit LoggerNewAllowance(_amountTokenIn - currentAllowance, _tokenIn, _exchangeRouter);
            } 
        }
         
    }

    /**
    * returns the balance of a given token 
    */
    function balanceOfToken(address _tokenAddress) public view returns(uint) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    /**
     * Verifies allowance of a router address
     */
    function checkAllowance (address _tokenAddress, address _routerAddress) public view returns(uint){
        return IERC20(_tokenAddress).allowance(address(this), _routerAddress);
    }

    
}
