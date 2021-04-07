//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../orchestrator/EthItemOrchestratorDependantElement.sol";
import "./IKnowledgeBase.sol";
import "../models/common/IEthItemModelBase.sol";

/**
 * @title IKnowledgeBase
 * @dev This contract represents the Factory Used to deploy all the EthItems, keeping track of them.
 */
contract KnowledgeBase is IKnowledgeBase, EthItemOrchestratorDependantElement {

    mapping(address => bool) internal _ethItems;
    mapping(address => mapping(uint256 => address)) internal _wrapped;

    address[] internal _erc20Wrappers;

    constructor(
        address doubleProxy,
        address[] memory ethItems,
        address[] memory wrapped,
        address[] memory wrappers,
        address[] memory erc20Wrappers
    ) public EthItemOrchestratorDependantElement(doubleProxy) {
        for(uint256 i = 0; i < ethItems.length; i++) {
            _ethItems[ethItems[i]] = true;
        }
        assert(wrapped.length == wrappers.length);
        for(uint256 i = 0; i < wrapped.length; i++) {
            _wrapped[wrapped[i]][IEthItemModelBase(wrappers[i]).modelVersion()] = wrappers[i];
        }
        _erc20Wrappers = erc20Wrappers;
    }

    function _registerSpecificInterfaces() internal virtual override {
        _registerInterface(this.setEthItem.selector);
        _registerInterface(this.setWrapped.selector);
        _registerInterface(this.setERC20Wrapper.selector);
    }

    function setEthItem(address ethItem) public override byOrchestrator {
        _ethItems[ethItem] = true;
    }

    function isEthItem(address ethItem) public override view returns(bool) {
        return _ethItems[ethItem];
    }

    function setWrapped(address wrappedAddress, address ethItem) public override byOrchestrator {
        _wrapped[wrappedAddress][IEthItemModelBase(ethItem).modelVersion()] = ethItem;
    }

    function wrapper(address wrappedAddress, uint256 modelVersion) public override view returns (address ethItem) {
        ethItem = _wrapped[wrappedAddress][modelVersion];
    }

    function setERC20Wrapper(address erc20Wrapper) public override byOrchestrator {
        _erc20Wrappers.push(erc20Wrapper);
    }

    function erc20Wrappers() public view override returns(address[] memory) {
        return _erc20Wrappers;
    }

    function erc20Wrapper() public view override returns(address) {
        return _erc20Wrappers[_erc20Wrappers.length - 1];
    }
}