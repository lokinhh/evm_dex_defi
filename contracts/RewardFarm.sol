// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Ownable2Step} from '@openzeppelin/contracts/access/Ownable2Step.sol';
import {Pausable} from '@openzeppelin/contracts/utils/Pausable.sol';

/// @title RewardFarm
/// @notice Stake LP tokens to earn CDX from a pre-funded reward pool (no minting).
contract RewardFarm is ReentrancyGuard, Ownable2Step, Pausable {
  using SafeERC20 for IERC20;

  struct PoolInfo {
    IERC20 lpToken;
    uint256 allocPoint;
    uint256 lastRewardTime;
    uint256 accRewardPerShare;
    uint256 totalStaked;
  }

  struct UserInfo {
    uint256 amount;
    uint256 rewardDebt;
    uint256 pendingRewards;
  }

  IERC20 public immutable rewardToken;
  uint256 public rewardPerSecond;
  uint256 public immutable startTime;
  uint256 public endTime;
  uint256 public totalAllocPoint;
  uint256 public totalRewardsPaid;

  PoolInfo[] public poolInfo;
  mapping(uint256 => mapping(address => UserInfo)) public userInfo;

  event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
  event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
  event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
  event PoolAdded(uint256 indexed pid, address lpToken, uint256 allocPoint);
  event RewardsFunded(address indexed from, uint256 amount);
  event EmissionUpdated(uint256 rewardPerSecond, uint256 endTime);

  constructor(
    IERC20 _rewardToken,
    uint256 _rewardPerSecond,
    uint256 _startTime,
    uint256 _endTime
  ) Ownable(msg.sender) {
    require(address(_rewardToken) != address(0), 'RewardFarm: zero token');
    require(_endTime > _startTime, 'RewardFarm: bad schedule');
    rewardToken = _rewardToken;
    rewardPerSecond = _rewardPerSecond;
    startTime = _startTime;
    endTime = _endTime;
  }

  function poolLength() external view returns (uint256) {
    return poolInfo.length;
  }

  function rewardBalance() public view returns (uint256) {
    return rewardToken.balanceOf(address(this));
  }

  function fundRewards(uint256 amount) external {
    require(amount > 0, 'RewardFarm: zero amount');
    rewardToken.safeTransferFrom(msg.sender, address(this), amount);
    emit RewardsFunded(msg.sender, amount);
  }

  function addPool(address lpToken, uint256 allocPoint) external onlyOwner {
    require(lpToken != address(0), 'RewardFarm: zero lp');
    require(allocPoint > 0, 'RewardFarm: zero alloc');
    totalAllocPoint += allocPoint;
    poolInfo.push(
      PoolInfo({
        lpToken: IERC20(lpToken),
        allocPoint: allocPoint,
        lastRewardTime: _effectiveTime(),
        accRewardPerShare: 0,
        totalStaked: 0
      })
    );
    emit PoolAdded(poolInfo.length - 1, lpToken, allocPoint);
  }

  function setEmission(uint256 newRewardPerSecond, uint256 newEndTime) external onlyOwner {
    require(newEndTime > block.timestamp, 'RewardFarm: end in past');
    require(newEndTime > startTime, 'RewardFarm: bad end');
    rewardPerSecond = newRewardPerSecond;
    endTime = newEndTime;
    emit EmissionUpdated(newRewardPerSecond, newEndTime);
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  function pendingReward(uint256 pid, address user) public view returns (uint256) {
    require(pid < poolInfo.length, 'RewardFarm: bad pid');
    PoolInfo storage pool = poolInfo[pid];
    UserInfo storage u = userInfo[pid][user];
    uint256 acc = pool.accRewardPerShare;
    uint256 lpSupply = pool.totalStaked;
    uint256 lastTime = pool.lastRewardTime;
    uint256 effectiveNow = _effectiveTime();

    if (effectiveNow > lastTime && lpSupply != 0 && totalAllocPoint > 0) {
      uint256 time = effectiveNow - lastTime;
      uint256 reward = (time * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
      acc += (reward * 1e12) / lpSupply;
    }
    return u.pendingRewards + (u.amount * acc) / 1e12 - u.rewardDebt;
  }

  function deposit(uint256 pid, uint256 amount) external nonReentrant whenNotPaused {
    require(pid < poolInfo.length, 'RewardFarm: bad pid');
    PoolInfo storage pool = poolInfo[pid];
    UserInfo storage user = userInfo[pid][msg.sender];
    _updatePool(pid);
    _accruePending(pool, user);
    if (amount > 0) {
      pool.lpToken.safeTransferFrom(msg.sender, address(this), amount);
      user.amount += amount;
      pool.totalStaked += amount;
    }
    user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;
    emit Deposit(msg.sender, pid, amount);
  }

  function withdraw(uint256 pid, uint256 amount) external nonReentrant {
    require(pid < poolInfo.length, 'RewardFarm: bad pid');
    PoolInfo storage pool = poolInfo[pid];
    UserInfo storage user = userInfo[pid][msg.sender];
    require(user.amount >= amount, 'RewardFarm: insufficient');
    _updatePool(pid);
    _accruePending(pool, user);
    if (amount > 0) {
      user.amount -= amount;
      pool.totalStaked -= amount;
      pool.lpToken.safeTransfer(msg.sender, amount);
    }
    user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;
    emit Withdraw(msg.sender, pid, amount);
  }

  function harvest(uint256 pid) external nonReentrant whenNotPaused {
    require(pid < poolInfo.length, 'RewardFarm: bad pid');
    PoolInfo storage pool = poolInfo[pid];
    UserInfo storage user = userInfo[pid][msg.sender];
    _updatePool(pid);
    uint256 pending = user.pendingRewards + (user.amount * pool.accRewardPerShare) / 1e12 - user.rewardDebt;
    require(pending > 0, 'RewardFarm: no reward');
    require(rewardBalance() >= pending, 'RewardFarm: insufficient rewards');
    user.pendingRewards = 0;
    user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;
    totalRewardsPaid += pending;
    rewardToken.safeTransfer(msg.sender, pending);
    emit Harvest(msg.sender, pid, pending);
  }

  function _accruePending(PoolInfo storage pool, UserInfo storage user) internal {
    if (user.amount == 0) return;
    uint256 pending = (user.amount * pool.accRewardPerShare) / 1e12 - user.rewardDebt;
    if (pending > 0) user.pendingRewards += pending;
  }

  function _updatePool(uint256 pid) internal {
    PoolInfo storage pool = poolInfo[pid];
    uint256 effectiveNow = _effectiveTime();
    if (effectiveNow <= pool.lastRewardTime || totalAllocPoint == 0) return;
    uint256 lpSupply = pool.totalStaked;
    if (lpSupply == 0) {
      pool.lastRewardTime = effectiveNow;
      return;
    }
    uint256 time = effectiveNow - pool.lastRewardTime;
    uint256 reward = (time * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
    pool.accRewardPerShare += (reward * 1e12) / lpSupply;
    pool.lastRewardTime = effectiveNow;
  }

  function _effectiveTime() internal view returns (uint256) {
    uint256 t = block.timestamp;
    if (t < startTime) return startTime;
    if (t > endTime) return endTime;
    return t;
  }
}
