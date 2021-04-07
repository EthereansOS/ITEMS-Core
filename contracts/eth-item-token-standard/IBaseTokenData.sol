// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface IBaseTokenData {
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);
}