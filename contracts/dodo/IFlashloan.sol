// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFlashloan {
    
    struct FlashInputData {
        address flashLoanPool;
        uint256 loanAmount;
        Swap[] swaps;
    }

    struct Swap {
        uint8 protocolTypeIndex;
        uint24 fee;
        address routerAddress;
        address tokenInAddress;
        address tokenOutAddress;
    }
}
