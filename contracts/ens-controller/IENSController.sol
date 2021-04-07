//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../orchestrator/IEthItemOrchestratorDependantElement.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IENSController is IEthItemOrchestratorDependantElement, IERC721Receiver {

    function attachENS(address ethItem, string calldata ens) external;

    function transfer(address receiver, bytes32 domainNode, uint256 domainId, bool reclaimFirst, bool safeTransferFrom, bytes memory payload) external;

    function data() external view returns(uint256 domainId, bytes32 domainNode);

    event ENSAttached(address indexed ethItem, string indexed ensIndex, string ens);
}