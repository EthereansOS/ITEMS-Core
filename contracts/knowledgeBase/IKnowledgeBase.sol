//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../orchestrator/IEthItemOrchestratorDependantElement.sol";

/**
 * @title IKnowledgeBase
 * @dev This contract represents the Factory Used to deploy all the EthItems, keeping track of them.
 */
interface IKnowledgeBase is IEthItemOrchestratorDependantElement {

    function setERC20Wrapper(address erc20Wrapper) external;

    function erc20Wrappers() external view returns(address[] memory);

    function erc20Wrapper() external view returns(address);

    function setEthItem(address ethItem) external;

    function isEthItem(address ethItem) external view returns(bool);

    function setWrapped(address wrappedAddress, address ethItem) external;

    function wrapper(address wrappedAddress, uint256 version) external view returns (address ethItem);
}