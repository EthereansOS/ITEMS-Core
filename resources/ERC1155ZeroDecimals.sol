//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../contracts/projection/ItemProjection.sol";

contract ERC1155ZeroDecimals is ItemProjection {

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function decimals(uint256) public override view returns(uint256) {
        return 0;
    }
}