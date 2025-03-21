// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

/// @notice Early LP staking farm — rewards minted on harvest (v1).
contract RewardFarm is Ownable {
  struct PoolInfo {
    IERC20 lpToken;
    uint256 allocPoint;
    uint256 totalStaked;
  }

  IERC20 public rewardToken;
  PoolInfo[] public poolInfo;

  constructor(address _reward) Ownable(msg.sender) {
    rewardToken = IERC20(_reward);
  }

  function addPool(address lpToken, uint256 allocPoint) external onlyOwner {
    poolInfo.push(PoolInfo({ lpToken: IERC20(lpToken), allocPoint: allocPoint, totalStaked: 0 }));
  }
}
