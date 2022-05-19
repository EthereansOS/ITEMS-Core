//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "@ethereansos/swissknife/contracts/factory/impl/Factory.sol";

interface IItemProjectionFactory is IFactory {

    function mainInterface() external view returns(address);

    function deploySingleton(bytes calldata code, bytes calldata deployData) external returns(address deployedAddress, bytes memory deployLazyInitResponse);

    function addModel(bytes calldata code) external returns(address modelAddress, uint256 positionIndex);

    function models() external view returns(address[] memory);
}