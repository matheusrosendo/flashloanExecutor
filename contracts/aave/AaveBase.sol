// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AaveBase {

    /**
        This function is called by aave after your contract has received the flash loaned amount
    */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address /*initiator*/,
        bytes calldata data
    ) external returns (bool) {
        return _flashloanCallbackAave(assets, amounts, premiums, data);
    }

    /**
        this function is supposed to be overwriten by main Flashloan contract
     */
    function _flashloanCallbackAave(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        bytes calldata data
    ) internal virtual returns (bool) {}

}
