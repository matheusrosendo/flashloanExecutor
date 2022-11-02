// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IFlashloan.sol";
import "./IDODO.sol";
import "./RouteUtils.sol";

contract DodoBase is IFlashloan {
    //Note: CallBack function executed by DODOV2(DVM) flashLoan pool
    function DVMFlashLoanCall(
        address sender,
        uint256 baseAmount,
        uint256 quoteAmount,
        bytes calldata data
    ) external {
        _flashLoanCallBackDodo(sender, baseAmount, quoteAmount, data);
    }

    //Note: CallBack function executed by DODOV2(DPP) flashLoan pool
    function DPPFlashLoanCall(
        address sender,
        uint256 baseAmount,
        uint256 quoteAmount,
        bytes calldata data
    ) external {
        _flashLoanCallBackDodo(sender, baseAmount, quoteAmount, data);
    }

    //Note: CallBack function executed by DODOV2(DSP) flashLoan pool
    function DSPFlashLoanCall(
        address sender,
        uint256 baseAmount,
        uint256 quoteAmount,
        bytes calldata data
    ) external {
        _flashLoanCallBackDodo(sender, baseAmount, quoteAmount, data);
    }

    function _flashLoanCallBackDodo(
        address,
        uint256,
        uint256,
        bytes calldata data
    ) internal virtual {}

    /**
     * Initial data verification, make sure at least one swap is there, loan token must be equal the last, and loan token must be Base or Quote on Dodo pool address
     */
    modifier checkInputData(FlashInputData memory _flashInputData) {
        address loanToken = RouteUtils.getInitialToken(_flashInputData);
        bool loanEqBase = (loanToken == IDODO(_flashInputData.flashLoanPool)._BASE_TOKEN_());
        bool loanEqQuote = (loanToken == IDODO(_flashInputData.flashLoanPool)._QUOTE_TOKEN_());
        require(loanEqBase || loanEqQuote, "Loan token not found on informed flashloan pool address");
        require(_flashInputData.swaps.length > 1, "At least two swaps are necessary to execute flashloan");
        address lastToken = RouteUtils.getLastSwapToken(_flashInputData);
        require(loanToken == lastToken, "Out token on last swap must be equal loan token");
        _;
    }
}
