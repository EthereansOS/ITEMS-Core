// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IBaseTokenData.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Data is IBaseTokenData, IERC20 {
    function decimals() external view returns (uint256);
}