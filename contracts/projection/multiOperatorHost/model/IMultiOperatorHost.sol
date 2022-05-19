//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../../IItemProjection.sol";

interface IMultiOperatorHost is IItemProjection {

    event Operator(uint256 indexed op, address indexed from, address indexed to);

    function operator(uint256 op) external view returns (address);

    function setOperator(uint256 op, address newValue) external returns(address oldValue);
}