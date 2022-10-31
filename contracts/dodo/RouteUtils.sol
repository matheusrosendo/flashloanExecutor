// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IFlashloan.sol";

library RouteUtils {
    function getInitialToken(IFlashloan.FlashInputData memory _flashInputData)
        internal
        pure
        returns (address)
    {
        return _flashInputData.swaps[0].tokenInAddress;
    }

    function getLastSwapToken(IFlashloan.FlashInputData memory _flashInputData)
        internal
        pure
        returns (address)
    {

        return _flashInputData.swaps[_flashInputData.swaps.length-1].tokenOutAddress;
    }

}
