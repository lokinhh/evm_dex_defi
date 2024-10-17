// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {DexFactory} from './DexFactory.sol';
import {DexPair} from './DexPair.sol';
import {WETH9} from './WETH9.sol';

contract DexRouter is ReentrancyGuard {
  using SafeERC20 for IERC20;

  address public immutable factory;
  address public immutable WETH;

  modifier ensure(uint256 deadline) {
    require(deadline >= block.timestamp, 'DexRouter: EXPIRED');
    _;
  }

  constructor(address _factory, address _weth) {
    factory = _factory;
    WETH = _weth;
  }

  function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
    require(tokenA != tokenB, 'DexRouter: IDENTICAL_ADDRESSES');
    (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), 'DexRouter: ZERO_ADDRESS');
  }

  function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure returns (uint256 amountB) {
    require(amountA > 0, 'DexRouter: INSUFFICIENT_AMOUNT');
    require(reserveA > 0 && reserveB > 0, 'DexRouter: INSUFFICIENT_LIQUIDITY');
    amountB = (amountA * reserveB) / reserveA;
  }

  function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
    require(amountIn > 0, 'DexRouter: INSUFFICIENT_INPUT_AMOUNT');
    require(reserveIn > 0 && reserveOut > 0, 'DexRouter: INSUFFICIENT_LIQUIDITY');
    uint256 amountInWithFee = amountIn * 997;
    uint256 numerator = amountInWithFee * reserveOut;
    uint256 denominator = reserveIn * 1000 + amountInWithFee;
    amountOut = numerator / denominator;
  }

  function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts) {
    require(path.length >= 2, 'DexRouter: INVALID_PATH');
    amounts = new uint256[](path.length);
    amounts[0] = amountIn;
    for (uint256 i; i < path.length - 1; i++) {
      (uint112 reserve0, uint112 reserve1,) = DexPair(DexFactory(factory).getPair(path[i], path[i + 1])).getReserves();
      (uint256 reserveIn, uint256 reserveOut) = path[i] < path[i + 1] ? (reserve0, reserve1) : (reserve1, reserve0);
      amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
    }
  }

  function addLiquidity(
    address tokenA,
    address tokenB,
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline
  ) external nonReentrant ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
    (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
    address pair = DexFactory(factory).getPair(tokenA, tokenB);
    IERC20(tokenA).safeTransferFrom(msg.sender, pair, amountA);
    IERC20(tokenB).safeTransferFrom(msg.sender, pair, amountB);
    liquidity = DexPair(pair).mint(to);
  }

  function _addLiquidity(
    address tokenA,
    address tokenB,
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin
  ) internal returns (uint256 amountA, uint256 amountB) {
    _createPairIfNeeded(tokenA, tokenB);
    (uint256 reserveA, uint256 reserveB) = _getReserves(tokenA, tokenB);
    if (reserveA == 0 && reserveB == 0) {
      (amountA, amountB) = (amountADesired, amountBDesired);
    } else {
      uint256 amountBOptimal = quote(amountADesired, reserveA, reserveB);
      if (amountBOptimal <= amountBDesired) {
        require(amountBOptimal >= amountBMin, 'DexRouter: INSUFFICIENT_B_AMOUNT');
        (amountA, amountB) = (amountADesired, amountBOptimal);
      } else {
        uint256 amountAOptimal = quote(amountBDesired, reserveB, reserveA);
        require(amountAOptimal <= amountADesired && amountAOptimal >= amountAMin, 'DexRouter: INSUFFICIENT_A_AMOUNT');
        (amountA, amountB) = (amountAOptimal, amountBDesired);
      }
    }
  }

  function removeLiquidity(
    address tokenA,
    address tokenB,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline
  ) external nonReentrant ensure(deadline) returns (uint256 amountA, uint256 amountB) {
    address pair = DexFactory(factory).getPair(tokenA, tokenB);
    DexPair(pair).transferFrom(msg.sender, pair, liquidity);
    (uint256 amount0, uint256 amount1) = DexPair(pair).burn(to);
    (address token0,) = _sortTokens(tokenA, tokenB);
    (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
    require(amountA >= amountAMin && amountB >= amountBMin, 'DexRouter: INSUFFICIENT_OUTPUT_AMOUNT');
  }

  function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline
  ) external nonReentrant ensure(deadline) returns (uint256[] memory amounts) {
    amounts = getAmountsOut(amountIn, path);
    require(amounts[amounts.length - 1] >= amountOutMin, 'DexRouter: INSUFFICIENT_OUTPUT_AMOUNT');
    IERC20(path[0]).safeTransferFrom(msg.sender, _pairFor(path[0], path[1]), amountIn);
    _swap(amounts, path, to);
  }

  function swapExactETHForTokens(
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline
  ) external payable nonReentrant ensure(deadline) returns (uint256[] memory amounts) {
    require(path[0] == WETH, 'DexRouter: INVALID_PATH');
    amounts = getAmountsOut(msg.value, path);
    require(amounts[amounts.length - 1] >= amountOutMin, 'DexRouter: INSUFFICIENT_OUTPUT_AMOUNT');
    WETH9(payable(WETH)).deposit{value: msg.value}();
    assert(WETH9(payable(WETH)).transfer(_pairFor(path[0], path[1]), msg.value));
    _swap(amounts, path, to);
  }

  function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
    for (uint256 i; i < path.length - 1; i++) {
      (address input, address output) = (path[i], path[i + 1]);
      (address token0,) = _sortTokens(input, output);
      uint256 amountOut = amounts[i + 1];
      (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
      address to_ = i < path.length - 2 ? _pairFor(output, path[i + 2]) : _to;
      DexPair(_pairFor(input, output)).swap(amount0Out, amount1Out, to_, '');
    }
  }

  function _pairFor(address tokenA, address tokenB) internal view returns (address pair) {
    pair = DexFactory(factory).getPair(tokenA, tokenB);
    require(pair != address(0), 'DexRouter: PAIR_NOT_EXISTS');
  }

  function _createPairIfNeeded(address tokenA, address tokenB) internal {
    if (DexFactory(factory).getPair(tokenA, tokenB) == address(0)) {
      DexFactory(factory).createPair(tokenA, tokenB);
    }
  }

  function _getReserves(address tokenA, address tokenB) internal view returns (uint256 reserveA, uint256 reserveB) {
    (address token0,) = _sortTokens(tokenA, tokenB);
    (uint112 reserve0, uint112 reserve1,) = DexPair(DexFactory(factory).getPair(tokenA, tokenB)).getReserves();
    (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
  }

  receive() external payable {}
}
