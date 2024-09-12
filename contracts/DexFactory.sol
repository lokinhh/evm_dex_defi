// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DexPair} from './DexPair.sol';

contract DexFactory {
  address public feeTo;
  address public feeToSetter;

  mapping(address => mapping(address => address)) public getPair;
  address[] public allPairs;

  event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

  constructor(address _feeToSetter) {
    feeToSetter = _feeToSetter;
  }

  function allPairsLength() external view returns (uint256) {
    return allPairs.length;
  }

  function createPair(address tokenA, address tokenB) external returns (address pair) {
    require(tokenA != tokenB, 'DexFactory: IDENTICAL_ADDRESSES');
    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), 'DexFactory: ZERO_ADDRESS');
    require(getPair[token0][token1] == address(0), 'DexFactory: PAIR_EXISTS');

    bytes memory bytecode = type(DexPair).creationCode;
    bytes32 salt = keccak256(abi.encodePacked(token0, token1));
    assembly {
      pair := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
    }
    DexPair(pair).initialize(token0, token1);
    getPair[token0][token1] = pair;
    getPair[token1][token0] = pair;
    allPairs.push(pair);
    emit PairCreated(token0, token1, pair, allPairs.length);
  }

  function setFeeTo(address _feeTo) external {
    require(msg.sender == feeToSetter, 'DexFactory: FORBIDDEN');
    feeTo = _feeTo;
  }

  function setFeeToSetter(address _feeToSetter) external {
    require(msg.sender == feeToSetter, 'DexFactory: FORBIDDEN');
    feeToSetter = _feeToSetter;
  }
}
