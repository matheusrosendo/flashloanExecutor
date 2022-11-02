// SPDX-License-Identifier: agpl-3.0
//version modified by @matheusrosendo to complain the rest of the project 0.6.12 -> ^0.8.0 
pragma solidity ^0.8.0;
 

import {SafeMath} from '../../../../../openzeppelin/contracts/utils/math/SafeMath.sol';
import {IERC20} from '../../../../../openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '../../../../../openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IFlashLoanReceiver} from '../interfaces/IFlashLoanReceiver.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  ILendingPoolAddressesProvider public immutable override ADDRESSES_PROVIDER;
  ILendingPool public immutable override LENDING_POOL;

  constructor(ILendingPoolAddressesProvider provider) {
    ADDRESSES_PROVIDER = provider;
    LENDING_POOL = ILendingPool(provider.getLendingPool());
  }
}
