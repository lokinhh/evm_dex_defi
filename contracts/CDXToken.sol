// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

/// @notice Fixed-supply governance/reward token for ChainDex farms.
contract CDXToken is ERC20, Ownable {
  uint256 public immutable maxSupply;

  constructor(uint256 _maxSupply, address initialReceiver) ERC20('ChainDex', 'CDX') Ownable(msg.sender) {
    require(initialReceiver != address(0), 'CDX: zero receiver');
    maxSupply = _maxSupply;
    _mint(initialReceiver, _maxSupply);
  }
}
