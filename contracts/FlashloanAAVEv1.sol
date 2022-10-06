pragma solidity ^0.8.0;

import "./AddressCoderLib.sol";
import "./aave/FlashLoanReceiverBase.sol";
import "./aave/ILendingPoolAddressesProvider.sol";
import "./aave/ILendingPool.sol";
import "./SwapUniswapV2.sol";


contract FlashloanAAVEv1 is FlashLoanReceiverBase {
    SwapUniswapV2 swaps;
    using SafeERC20 for IERC20;
    event SwapLogger(uint AmountInitialIn, address router, address from, address to);
    event NewAllowanceLogger(uint increasedAmount, address token, address router);

    event LoggerExecuteOperation( address _reserve,
        uint256 currentBalance,
        uint256 _amount,
        uint256 _fee);
    event LoggerFlashloan( address _reserve,
        uint256 currentBalance,
        uint256 _amount);
     event LoggerBalance( address _reserve,
        uint256 oldBalance,
        uint256 newBalance);
    
    //pass to parent constructor the AAVEv1lendingPoolAddressesProviderAddress 
    constructor(SwapUniswapV2 _swapInstance) FlashLoanReceiverBase(0x24a42fD28C976A61Df5D00D0599C34c4f90748c8) public {
        swaps = _swapInstance;
    }

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        address _reserve,
        uint256 _amount,
        uint256 _fee,
        bytes calldata _packedAddresses
    )
        external
        override
    {
        uint256 currentBalance = getBalanceInternal(address(this), _reserve);
        
        emit LoggerExecuteOperation(_reserve, currentBalance, _amount, _fee);
        require(_amount <= currentBalance, "Invalid balance, was the flashLoan successful?");

        //unpack addressesss array containning routes, from tokens, to tokens 
        address[] memory addressessArray = AddressCoder.decodeAddressArray(_packedAddresses);

        //execute swaps
        executeUniswapV2(_amount, addressessArray);

        uint totalDebt = _amount + _fee;
        transferFundsBackToPoolInternal(_reserve, totalDebt);
    }

    /**
        Generic function (no logic)
     */
    function flashloan(address _asset, uint256 _amount) public onlyOwner {
        bytes memory data = "";

        uint256 currentBalance = getBalanceInternal(address(this), _asset);
        emit LoggerFlashloan(_asset, currentBalance, _amount);

        ILendingPool lendingPool = ILendingPool(addressesProvider.getLendingPool());
        lendingPool.flashLoan(address(this), _asset, _amount, data);        
    }

    
    function flashloanUniswapV2(uint _amountInitialIn, address[] memory _addrArr) public onlyOwner {
        
        require(_addrArr.length % 3 == 0, "Error: not a valid amount of address, array size must be multiple of 3");
        bytes memory byteAddressess = AddressCoder.encodeAddressArray(_addrArr);

        //take current balance of the first token of the list (0 is router, 1 is from, 2 is to)
        uint256 currentBalance = getBalanceInternal(address(this), _addrArr[1]);
        emit LoggerFlashloan(_addrArr[1], currentBalance, _amountInitialIn);

        ILendingPool lendingPool = ILendingPool(addressesProvider.getLendingPool());
        lendingPool.flashLoan(address(this), _addrArr[1], _amountInitialIn, byteAddressess);

        //shows new old and new balances of token _asset
        uint256 newBalance = getBalanceInternal(address(this), _addrArr[1]);
        emit LoggerBalance(_addrArr[1], currentBalance, newBalance);
    }


    /**
     * Function to be called by executeOperation (callback flashloan function)
     */
    function executeUniswapV2(uint _amountInitialIn, address[] memory _addressessArray) 
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
                emit NewAllowanceLogger(amountIn - currentAllowance, path[0], _addressessArray[i]);
                IERC20(path[0]).safeIncreaseAllowance(_addressessArray[i], amountIn - currentAllowance);
            }            
            emit SwapLogger(amountIn, _addressessArray[i], path[0], path[1]);
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

    //returns the balance of a given token 
    function balanceOfToken(address _tokenAddress) public view returns(uint) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    
    function checkAllowance (address _tokenAddress, address _routerAddress) public view returns(uint){
        return IERC20(_tokenAddress).allowance(address(this), _routerAddress);
    }
}
