//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/introspection/ERC165.sol";
import "./IEthItemOrchestratorDependantElement.sol";

abstract contract EthItemOrchestratorDependantElement is IEthItemOrchestratorDependantElement, ERC165 {

    string internal constant ETHITEM_ORCHESTRATOR_AUTHORIZED_KEY_PREFIX = "ehtitem.orchestrator.authorized";

    address internal _doubleProxy;

    constructor(address doubleProxy) public {
        _doubleProxy = doubleProxy;
        _registerInterfaces();
        _registerSpecificInterfaces();
    }

    function _registerInterfaces() internal {
        _registerInterface(this.setDoubleProxy.selector);
    }

    function _registerSpecificInterfaces() internal virtual;

    modifier byOrchestrator virtual {
        require(isAuthorizedOrchestrator(msg.sender), "Unauthorized Action!");
        _;
    }

    function doubleProxy() public view override returns(address) {
        return _doubleProxy;
    }

    function setDoubleProxy(address newDoubleProxy) public override byOrchestrator {
        _doubleProxy = newDoubleProxy;
    }

    function isAuthorizedOrchestrator(address operator) public view override returns(bool) {
        return IStateHolder(IMVDProxy(IDoubleProxy(_doubleProxy).proxy()).getStateHolderAddress()).getBool(_toStateHolderKey(ETHITEM_ORCHESTRATOR_AUTHORIZED_KEY_PREFIX, _toString(operator)));
    }

    function _toStateHolderKey(string memory a, string memory b) internal pure returns(string memory) {
        return _toLowerCase(string(abi.encodePacked(a, ".", b)));
    }

    function _toString(address _addr) internal pure returns(string memory) {
        bytes32 value = bytes32(uint256(_addr));
        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint(uint8(value[i + 12] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(value[i + 12] & 0x0f))];
        }
        return string(str);
    }

    function _toLowerCase(string memory str) internal pure returns(string memory) {
        bytes memory bStr = bytes(str);
        for (uint i = 0; i < bStr.length; i++) {
            bStr[i] = bStr[i] >= 0x41 && bStr[i] <= 0x5A ? bytes1(uint8(bStr[i]) + 0x20) : bStr[i];
        }
        return string(bStr);
    }
}

interface IDoubleProxy {
    function proxy() external view returns (address);
}

interface IMVDProxy {
    function getMVDFunctionalitiesManagerAddress() external view returns(address);
    function getMVDWalletAddress() external view returns (address);
    function getStateHolderAddress() external view returns(address);
}

interface IMVDFunctionalitiesManager {
    function isAuthorizedFunctionality(address functionality) external view returns(bool);
}

interface IStateHolder {
    function getBool(string calldata varName) external view returns (bool);
    function getUint256(string calldata name) external view returns(uint256);
    function getAddress(string calldata name) external view returns(address);
    function clear(string calldata varName) external returns(string memory oldDataType, bytes memory oldVal);
}