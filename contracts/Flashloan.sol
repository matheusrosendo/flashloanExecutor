pragma solidity ^0.6.6;

import "./aave/FlashLoanReceiverBase.sol";
import "./aave/ILendingPoolAddressesProvider.sol";
import "./aave/ILendingPool.sol";

contract Flashloan is FlashLoanReceiverBase {
    uint256 counter;

    event LoggerExecuteOperation( address _reserve,
        uint256 currentBalance,
        uint256 _amount,
        uint256 _fee);
    event LoggerFlashloan( address _reserve,
        uint256 currentBalance,
        uint256 _amount);

    constructor(address _addressProvider) FlashLoanReceiverBase(_addressProvider) public {
        counter = 0;
    }

    function incrementer(uint256 _incr) public onlyOwner{
        counter = counter + _incr;
    }

    function getCounter() public view returns (uint256){
        return counter;
    }

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        address _reserve,
        uint256 _amount,
        uint256 _fee,
        bytes calldata _params
    )
        external
        override
    {
        uint256 currentBalance = getBalanceInternal(address(this), _reserve);
        
        emit LoggerExecuteOperation(_reserve, currentBalance, _amount, _fee);
        require(_amount <= getBalanceInternal(address(this), _reserve), "Invalid balance, was the flashLoan successful?");

        //
        // Your logic goes here.
        // !! Ensure that *this contract* has enough of `_reserve` funds to payback the `_fee` !!
        //

        uint totalDebt = _amount.add(_fee);
        transferFundsBackToPoolInternal(_reserve, totalDebt);
    }

    /**
        Flash loan 1000000000000000000 wei (1 ether) worth of `_asset`
     */
    function flashloan(address _asset, uint256 _amount) public onlyOwner {
        bytes memory data = "";

        uint256 currentBalance = getBalanceInternal(address(this), _asset);
        emit LoggerFlashloan(_asset, currentBalance, _amount);

        ILendingPool lendingPool = ILendingPool(addressesProvider.getLendingPool());
        lendingPool.flashLoan(address(this), _asset, _amount, data);
    }
}
