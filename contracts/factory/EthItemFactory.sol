//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IEthItemFactory.sol";
import "../models/common/IEthItemModelBase.sol";

import "../orchestrator/EthItemOrchestratorDependantElement.sol";
import "eth-item-token-standard/IEthItemInteroperableInterface.sol";

contract EthItemFactory is IEthItemFactory, EthItemOrchestratorDependantElement {

    uint256[] private _mintFeePercentage;
    uint256[] private _burnFeePercentage;
    address private _ethItemInteroperableInterfaceModelAddress;

    mapping(address => bool) private _isModel;

    address private _nativeModelAddress;
    address private _erc1155WrapperModelAddress;
    address private _erc721WrapperModelAddress;
    address private _erc20WrapperModelAddress;

    constructor(
        address doubleProxy,
        address ethItemInteroperableInterfaceModelAddress,
        address[] memory nativeModelAddresses,
        address[] memory erc1155WrapperModelAddresses,
        address[] memory erc721WrapperModelAddresses,
        address[] memory erc20WrapperModelAddresses,
        uint256 mintFeePercentageNumerator, uint256 mintFeePercentageDenominator,
        uint256 burnFeePercentageNumerator, uint256 burnFeePercentageDenominator) public EthItemOrchestratorDependantElement(doubleProxy) {
        _ethItemInteroperableInterfaceModelAddress = ethItemInteroperableInterfaceModelAddress;

        _nativeModelAddress = nativeModelAddresses[nativeModelAddresses.length - 1];
        for(uint256 i = 0; i < nativeModelAddresses.length; i++) {
            _isModel[nativeModelAddresses[i]] = true;
            emit NativeModel(nativeModelAddresses[i]);
        }

        _erc1155WrapperModelAddress = erc1155WrapperModelAddresses[erc1155WrapperModelAddresses.length - 1];
        for(uint256 i = 0; i < erc1155WrapperModelAddresses.length; i++) {
            _isModel[erc1155WrapperModelAddresses[i]] = true;
            emit ERC1155WrapperModel(erc1155WrapperModelAddresses[i]);
        }

        _erc721WrapperModelAddress = erc721WrapperModelAddresses[erc721WrapperModelAddresses.length - 1];
        for(uint256 i = 0; i < erc721WrapperModelAddresses.length; i++) {
            _isModel[erc721WrapperModelAddresses[i]] = true;
            emit ERC721WrapperModel(erc721WrapperModelAddresses[i]);
        }

        _erc20WrapperModelAddress = erc20WrapperModelAddresses[erc20WrapperModelAddresses.length - 1];
        for(uint256 i = 0; i < erc20WrapperModelAddresses.length; i++) {
            _isModel[erc20WrapperModelAddresses[i]] = true;
            emit ERC20WrapperModel(erc20WrapperModelAddresses[i]);
        }
        _mintFeePercentage.push(mintFeePercentageNumerator);
        _mintFeePercentage.push(mintFeePercentageDenominator);
        _burnFeePercentage.push(burnFeePercentageNumerator);
        _burnFeePercentage.push(burnFeePercentageDenominator);
    }

    function _registerSpecificInterfaces() internal virtual override {
        _registerInterface(this.setEthItemInteroperableInterfaceModel.selector);
        _registerInterface(this.setNativeModel.selector);
        _registerInterface(this.setERC1155WrapperModel.selector);
        _registerInterface(this.setERC20WrapperModel.selector);
        _registerInterface(this.setERC721WrapperModel.selector);
        _registerInterface(this.addNativeModel.selector);
        _registerInterface(this.addERC1155WrapperModel.selector);
        _registerInterface(this.addERC20WrapperModel.selector);
        _registerInterface(this.addERC721WrapperModel.selector);
        _registerInterface(this.setMintFeePercentage.selector);
        _registerInterface(this.setBurnFeePercentage.selector);
        _registerInterface(this.createNative.selector);
        _registerInterface(this.createWrappedERC1155.selector);
        _registerInterface(this.createWrappedERC20.selector);
        _registerInterface(this.createWrappedERC721.selector);
    }

    function isModel(address modelAddress) public override returns(bool) {
        return _isModel[modelAddress];
    }

    modifier setModel(address modelAddress) {
        require(modelAddress != address(0), "Void address");
        _isModel[modelAddress] = true;
        _;
    }

    modifier modelOnly(address modelAddress) {
        require(modelAddress == address(0) || isModel(modelAddress), "Not a model");
        _;
    }

    function ethItemInteroperableInterfaceModel() public override view returns (address ethItemInteroperableInterfaceModelAddress, uint256 ethItemInteroperableInterfaceModelVersion) {
        return (_ethItemInteroperableInterfaceModelAddress, IEthItemInteroperableInterface(_ethItemInteroperableInterfaceModelAddress).interoperableInterfaceVersion());
    }

    function setEthItemInteroperableInterfaceModel(address ethItemInteroperableInterfaceModelAddress) public override byOrchestrator {
        _ethItemInteroperableInterfaceModelAddress = ethItemInteroperableInterfaceModelAddress;
    }

    function nativeModel() public override view returns (address nativeModelAddress, uint256 nativeModelVersion) {
        return (_nativeModelAddress, IEthItemModelBase(_nativeModelAddress).modelVersion());
    }

    function setNativeModel(address nativeModelAddress) public override byOrchestrator setModel(nativeModelAddress) {
        emit NativeModel(_nativeModelAddress = nativeModelAddress);
    }

    function addNativeModel(address nativeModelAddress) public override byOrchestrator setModel(nativeModelAddress) {
        emit NativeModel(nativeModelAddress);
    }

    function erc1155WrapperModel() public override view returns (address erc1155WrapperModelAddress, uint256 erc1155WrapperModelVersion) {
        return (_erc1155WrapperModelAddress, IEthItemModelBase(_erc1155WrapperModelAddress).modelVersion());
    }

    function setERC1155WrapperModel(address erc1155WrapperModelAddress) public override byOrchestrator setModel(erc1155WrapperModelAddress) {
        emit ERC1155WrapperModel(_erc1155WrapperModelAddress = erc1155WrapperModelAddress);
    }

    function addERC1155WrapperModel(address erc1155WrapperModelAddress) public override byOrchestrator setModel(erc1155WrapperModelAddress) {
        emit ERC1155WrapperModel(erc1155WrapperModelAddress);
    }

    function erc20WrapperModel() public override view returns (address erc20WrapperModelAddress, uint256 erc20WrapperModelVersion) {
        return (_erc20WrapperModelAddress, IEthItemModelBase(_erc20WrapperModelAddress).modelVersion());
    }

    function setERC20WrapperModel(address erc20WrapperModelAddress) public override byOrchestrator setModel(erc20WrapperModelAddress) {
        emit ERC20WrapperModel(_erc20WrapperModelAddress = erc20WrapperModelAddress);
    }

    function addERC20WrapperModel(address erc20WrapperModelAddress) public override byOrchestrator setModel(erc20WrapperModelAddress) {
        emit ERC20WrapperModel(erc20WrapperModelAddress);
    }

    function erc721WrapperModel() public override view returns (address erc721WrapperModelAddress, uint256 erc721WrapperModelVersion) {
        return (_erc721WrapperModelAddress, IEthItemModelBase(_erc721WrapperModelAddress).modelVersion());
    }

    function setERC721WrapperModel(address erc721WrapperModelAddress) public override byOrchestrator setModel(erc721WrapperModelAddress) {
        emit ERC721WrapperModel(_erc721WrapperModelAddress = erc721WrapperModelAddress);
    }

    function addERC721WrapperModel(address erc721WrapperModelAddress) public override byOrchestrator setModel(erc721WrapperModelAddress) {
        emit ERC721WrapperModel(erc721WrapperModelAddress);
    }

    function mintFeePercentage() public override view returns (uint256 mintFeePercentageNumerator, uint256 mintFeePercentageDenominator) {
        return (_mintFeePercentage[0], _mintFeePercentage[1]);
    }

    function setMintFeePercentage(uint256 mintFeePercentageNumerator, uint256 mintFeePercentageDenominator) public override byOrchestrator {
        _mintFeePercentage[0] = mintFeePercentageNumerator;
        _mintFeePercentage[1] = mintFeePercentageDenominator;
    }

    function calculateMintFee(uint256 amountInDecimals) public override view returns (uint256 mintFee, address dfoWalletAddress) {
        if(_mintFeePercentage[0] == 0 || _mintFeePercentage[1] == 0) {
            return (0, address(0));
        }
        mintFee = ((amountInDecimals * _mintFeePercentage[0]) / _mintFeePercentage[1]);
        require(mintFee > 0, "Inhexistent mint fee, amount too low.");
        dfoWalletAddress = IMVDProxy(IDoubleProxy(_doubleProxy).proxy()).getMVDWalletAddress();
    }

    function burnFeePercentage() public override view returns (uint256 burnFeePercentageNumerator, uint256 burnFeePercentageDenominator) {
        return (_burnFeePercentage[0], _burnFeePercentage[1]);
    }

    function setBurnFeePercentage(uint256 burnFeePercentageNumerator, uint256 burnFeePercentageDenominator) public override byOrchestrator {
        _burnFeePercentage[0] = burnFeePercentageNumerator;
        _burnFeePercentage[1] = burnFeePercentageDenominator;
    }

    function calculateBurnFee(uint256 amountInDecimals) public override view returns (uint256 burnFee, address dfoWalletAddress) {
        if(_burnFeePercentage[0] == 0 || _burnFeePercentage[1] == 0) {
            return (0, address(0));
        }
        burnFee = ((amountInDecimals * _burnFeePercentage[0]) / _burnFeePercentage[1]);
        require(burnFee > 0, "Inhexistent burn fee, amount too low.");
        dfoWalletAddress = IMVDProxy(IDoubleProxy(_doubleProxy).proxy()).getMVDWalletAddress();
    }

    function createNative(address modelAddress, bytes memory modelInitCallPayload) public override byOrchestrator modelOnly(modelAddress) returns (address newNativeAddress, bytes memory modelInitCallResponse) {
        address model = modelAddress != address(0) ? modelAddress : _nativeModelAddress;
        bool modelInitCallResult = false;
        (modelInitCallResult, modelInitCallResponse) = (newNativeAddress = _clone(model)).call(modelInitCallPayload);
        require(modelInitCallResult, "Model Init call failed");
        IEthItemModelBase createdToken = IEthItemModelBase(newNativeAddress);
        (, uint256 itemModelVersion) = createdToken.interoperableInterfaceModel();
        uint256 modelVersion = createdToken.modelVersion();
        emit NewNativeCreated(createdToken.mainInterfaceVersion(), itemModelVersion, modelVersion, newNativeAddress);
        emit NewNativeCreated(model, modelVersion, newNativeAddress, msg.sender);
    }

    function createWrappedERC1155(address modelAddress, bytes memory modelInitCallPayload) public override byOrchestrator modelOnly(modelAddress) returns (address newERC1155WrapperAddress, bytes memory modelInitCallResponse) {
        address model = modelAddress != address(0) ? modelAddress : _erc1155WrapperModelAddress;
        bool modelInitCallResult = false;
        (modelInitCallResult, modelInitCallResponse) = (newERC1155WrapperAddress = _clone(model)).call(modelInitCallPayload);
        require(modelInitCallResult, "Model Init call failed");
        IEthItemModelBase createdToken = IEthItemModelBase(newERC1155WrapperAddress);
        (, uint256 itemModelVersion) = createdToken.interoperableInterfaceModel();
        uint256 modelVersion = createdToken.modelVersion();
        emit NewWrappedERC1155Created(createdToken.mainInterfaceVersion(), itemModelVersion, modelVersion, newERC1155WrapperAddress);
        emit NewWrappedERC1155Created(model, modelVersion, newERC1155WrapperAddress, msg.sender);
    }

    function createWrappedERC20(bytes memory modelInitCallPayload) public override byOrchestrator returns (address newERC20Address, bytes memory modelInitCallResponse) {
        address model = _erc20WrapperModelAddress;
        bool modelInitCallResult = false;
        (modelInitCallResult, modelInitCallResponse) = (newERC20Address = _clone(model)).call(modelInitCallPayload);
        require(modelInitCallResult, "Model Init call failed");
        IEthItemModelBase createdToken = IEthItemModelBase(newERC20Address);
        (, uint256 itemModelVersion) = createdToken.interoperableInterfaceModel();
        uint256 modelVersion = createdToken.modelVersion();
        emit NewWrappedERC20Created(createdToken.mainInterfaceVersion(), itemModelVersion, modelVersion, newERC20Address);
        emit NewWrappedERC20Created(model, modelVersion, newERC20Address, msg.sender);
    }

    function createWrappedERC721(address modelAddress, bytes memory modelInitCallPayload) public override byOrchestrator modelOnly(modelAddress) returns (address newERC721Address, bytes memory modelInitCallResponse) {
        address model = modelAddress != address(0) ? modelAddress : _erc721WrapperModelAddress;
        bool modelInitCallResult = false;
        (modelInitCallResult, modelInitCallResponse) = (newERC721Address = _clone(model)).call(modelInitCallPayload);
        require(modelInitCallResult, "Model Init call failed");
        IEthItemModelBase createdToken = IEthItemModelBase(newERC721Address);
        (, uint256 itemModelVersion) = createdToken.interoperableInterfaceModel();
        uint256 modelVersion = createdToken.modelVersion();
        emit NewWrappedERC721Created(createdToken.mainInterfaceVersion(), itemModelVersion, modelVersion, newERC721Address);
        emit NewWrappedERC721Created(model, modelVersion, newERC721Address, msg.sender);
    }

    function _clone(address original) internal returns (address copy) {
        assembly {
            mstore(
                0,
                or(
                    0x5880730000000000000000000000000000000000000000803b80938091923cF3,
                    mul(original, 0x1000000000000000000)
                )
            )
            copy := create(0, 0, 32)
            switch extcodesize(copy)
                case 0 {
                    invalid()
                }
        }
    }
}