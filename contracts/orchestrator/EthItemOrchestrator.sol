//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IEthItemOrchestrator.sol";
import "../factory/IEthItemFactory.sol";
import "../knowledgeBase/IKnowledgeBase.sol";
import "../ens-controller/IENSController.sol";
import "@openzeppelin/contracts/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "eth-item-token-standard/IEthItemMainInterface.sol";
import "../models/common/IEthItemModelBase.sol";

contract EthItemOrchestrator is IEthItemOrchestrator, ERC165 {

    address private constant ENS_TOKEN_ADDRESS = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85;

    address private _doubleProxy;
    address[] private _factories;
    address[] private _knowledgeBases;
    address private _ensController;

    constructor(
        address doubleProxy,
        address[] memory factoriesArray,
        address[] memory knowledgeBasesArray,
        address ensController
    ) public {
        _doubleProxy = doubleProxy;
        _factories = factoriesArray;
        _knowledgeBases = knowledgeBasesArray;
        _ensController = ensController;
    }

    function factories() public view override returns(address[] memory) {
        return _factories;
    }

    function factory() public view override returns(address) {
        return _factories[_factories.length - 1];
    }

    function knowledgeBases() public view override returns(address[] memory) {
        return _knowledgeBases;
    }

    function knowledgeBase() public view override returns(address) {
        return _knowledgeBases[_knowledgeBases.length - 1];
    }

    modifier byDFO virtual {
        require(_isFromDFO(msg.sender), "Unauthorized Action!");
        _;
    }

    function _isFromDFO(address sender) private view returns(bool) {
        IMVDProxy proxy = IMVDProxy(IDoubleProxy(_doubleProxy).proxy());
        if(IMVDFunctionalitiesManager(proxy.getMVDFunctionalitiesManagerAddress()).isAuthorizedFunctionality(sender)) {
            return true;
        }
        return proxy.getMVDWalletAddress() == sender;
    }

    function doubleProxy() public view override returns (address) {
        return _doubleProxy;
    }

    function setDoubleProxy(address newDoubleProxy) public override byDFO {
        _doubleProxy = newDoubleProxy;
        for(uint256 i = 0; i < _factories.length; i++) {
            IEthItemOrchestratorDependantElement element = IEthItemOrchestratorDependantElement(_factories[i]);
            if(element.supportsInterface(this.setDoubleProxy.selector)) {
                element.setDoubleProxy(_doubleProxy);
            }
        }
        for(uint256 i = 0; i < _knowledgeBases.length; i++) {
            IEthItemOrchestratorDependantElement element = IEthItemOrchestratorDependantElement(_knowledgeBases[i]);
            if(element.supportsInterface(this.setDoubleProxy.selector)) {
                element.setDoubleProxy(_doubleProxy);
            }
        }
        if(_ensController != address(0)) {
            IEthItemOrchestratorDependantElement element = IEthItemOrchestratorDependantElement(_ensController);
            if(element.supportsInterface(this.setDoubleProxy.selector)) {
                element.setDoubleProxy(_doubleProxy);
            }
        }
    }

    function ENSController() public override view returns (address) {
        return _ensController;
    }

    function setENSController(address newEnsController) public override byDFO {
        if(newEnsController != address(0)) {
            require(IEthItemOrchestratorDependantElement(newEnsController).doubleProxy() == _doubleProxy, "Wrong Double Proxy");
        }
        _ensController = newEnsController;
    }

    function transferENS(address receiver, bytes32 domainNode, uint256 domainId, bool reclaimFirst, bool safeTransferFrom, bytes memory payload) public override byDFO {
        IENSController(_ensController).transfer(receiver, domainNode, domainId, reclaimFirst, safeTransferFrom, payload);
    }

    function setMintFeePercentage(uint256 mintFeePercentageNumerator, uint256 mintFeePercentageDenominator) public override byDFO {
        for(uint256 i = 0; i < _factories.length; i++) {
            IEthItemFactory element = IEthItemFactory(_factories[i]);
            if(element.supportsInterface(this.setMintFeePercentage.selector)) {
                element.setMintFeePercentage(mintFeePercentageNumerator, mintFeePercentageDenominator);
            }
        }
    }

    function setBurnFeePercentage(uint256 burnFeePercentageNumerator, uint256 burnFeePercentageDenominator) public override byDFO {
        for(uint256 i = 0; i < _factories.length; i++) {
            IEthItemFactory element = IEthItemFactory(_factories[i]);
            if(element.supportsInterface(this.setBurnFeePercentage.selector)) {
                element.setBurnFeePercentage(burnFeePercentageNumerator, burnFeePercentageDenominator);
            }
        }
    }

    function setFactory(address newFactory) public override byDFO {
        require(IEthItemOrchestratorDependantElement(newFactory).doubleProxy() == _doubleProxy, "Wrong Double Proxy");
        _factories.push(newFactory);
    }

    function setKnowledgeBase(address newKnowledgeBase) public override byDFO {
        require(IEthItemOrchestratorDependantElement(newKnowledgeBase).doubleProxy() == _doubleProxy, "Wrong Double Proxy");
        _knowledgeBases.push(newKnowledgeBase);
    }

    function setEthItemInteroperableInterfaceModel(address ethItemInteroperableInterfaceModelAddress) public override byDFO {
        IEthItemFactory element = IEthItemFactory(factory());
        if(element.supportsInterface(this.setEthItemInteroperableInterfaceModel.selector)) {
            element.setEthItemInteroperableInterfaceModel(ethItemInteroperableInterfaceModelAddress);
        }
    }

    function setNativeModel(address nativeModelAddress) public override byDFO {
        IEthItemFactory element = IEthItemFactory(factory());
        if(element.supportsInterface(this.setNativeModel.selector)) {
            element.setNativeModel(nativeModelAddress);
        }
    }

    function addNativeModel(address nativeModelAddress) public override byDFO {
        IEthItemFactory element = IEthItemFactory(factory());
        if(element.supportsInterface(this.addNativeModel.selector)) {
            element.addNativeModel(nativeModelAddress);
        }
    }

    function setERC1155WrapperModel(address erc1155WrapperModelAddress) public override byDFO {
        IEthItemFactory element = IEthItemFactory(factory());
        if(element.supportsInterface(this.setERC1155WrapperModel.selector)) {
            element.setERC1155WrapperModel(erc1155WrapperModelAddress);
        }
    }

    function addERC1155WrapperModel(address erc1155WrapperModelAddress) public override byDFO {
        IEthItemFactory element = IEthItemFactory(factory());
        if(element.supportsInterface(this.addERC1155WrapperModel.selector)) {
            element.addERC1155WrapperModel(erc1155WrapperModelAddress);
        }
    }

    function setERC20WrapperModel(address erc20WrapperModelAddress) public override byDFO {
        IEthItemFactory element = IEthItemFactory(factory());
        if(element.supportsInterface(this.setERC20WrapperModel.selector)) {
            element.setERC20WrapperModel(erc20WrapperModelAddress);
        }
    }

    function addERC20WrapperModel(address erc20WrapperModelAddress) public override byDFO {
        IEthItemFactory element = IEthItemFactory(factory());
        if(element.supportsInterface(this.addERC20WrapperModel.selector)) {
            element.addERC20WrapperModel(erc20WrapperModelAddress);
        }
    }

    function setERC721WrapperModel(address erc721WrapperModelAddress) public override byDFO {
        IEthItemFactory element = IEthItemFactory(factory());
        if(element.supportsInterface(this.setERC721WrapperModel.selector)) {
            element.setERC721WrapperModel(erc721WrapperModelAddress);
        }
    }

    function addERC721WrapperModel(address erc721WrapperModelAddress) public override byDFO {
        IEthItemFactory element = IEthItemFactory(factory());
        if(element.supportsInterface(this.addERC721WrapperModel.selector)) {
            element.addERC721WrapperModel(erc721WrapperModelAddress);
        }
    }

    function onERC1155Received(
        address,
        address owner,
        uint256 objectId,
        uint256 amount,
        bytes memory payload
    ) public virtual override returns (bytes4) {
        address ethItem = _getOrCreateERC1155Wrapper(msg.sender, objectId, payload);
        IEthItemMainInterface(msg.sender).safeTransferFrom(address(this), ethItem, objectId, amount, "");
        IERC20 item = IEthItemMainInterface(ethItem).asInteroperable(objectId);
        item.transfer(owner, item.balanceOf(address(this)));
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address owner,
        uint256[] memory objectIds,
        uint256[] memory amounts,
        bytes memory payload
    ) public virtual override returns (bytes4) {
        address ethItem = _getOrCreateERC1155Wrapper(msg.sender, objectIds[0], payload);
        IEthItemMainInterface(msg.sender).safeBatchTransferFrom(address(this), ethItem, objectIds, amounts, "");
        for(uint256 i = 0; i < objectIds.length; i++) {
            IERC20 item = IEthItemMainInterface(ethItem).asInteroperable(objectIds[i]);
            item.transfer(owner, item.balanceOf(address(this)));
        }
        return this.onERC1155BatchReceived.selector;
    }

    function _getOrCreateERC1155Wrapper(address source, uint256 objectId, bytes memory payload) private returns(address ethItem) {
        address model = payload.length == 0 ? address(0) : abi.decode(payload, (address));
        uint256 version = model == address(0) ? 0 : IEthItemModelBase(model).modelVersion();
        IEthItemFactory currentFactory = IEthItemFactory(factory());
        if(model == address(0)) {
            (,version) = currentFactory.erc1155WrapperModel();
        }
        ethItem = _checkEthItem(msg.sender, version);
        if(ethItem == address(0)) {
            IKnowledgeBase currentKnowledgeBase = IKnowledgeBase(knowledgeBase());
            currentKnowledgeBase.setEthItem(ethItem = _createERC1155Wrapper(currentFactory, source, objectId, model));
            currentKnowledgeBase.setWrapped(source, ethItem);
        }
    }

    function _createERC1155Wrapper(IEthItemFactory currentFactory, address source, uint256 objectId, address model) private returns(address ethItem) {
        (string memory name, string memory symbol) = _extractNameAndSymbol(source);
        (bool supportsSpecificName, bool supportsSpecificSymbol, bool supportsSpecificDecimals) = _extractSpecificData(source, objectId);
        bytes memory modelInitPayload = abi.encodeWithSignature("init(address,string,string,bool,bool,bool)", source, name, symbol, supportsSpecificName, supportsSpecificSymbol, supportsSpecificDecimals);
        (ethItem,) = currentFactory.createWrappedERC1155(model, modelInitPayload);
    }

    function _extractNameAndSymbol(address source) private view returns(string memory name, string memory symbol) {
        IEthItemMainInterface nft = IEthItemMainInterface(source);
        try nft.name() returns(string memory n) {
            name = n;
        } catch {
        }
        try nft.symbol() returns(string memory s) {
            symbol = s;
        } catch {
        }
        if(keccak256(bytes(name)) == keccak256("")) {
            name = _toString(source);
        }
        if(keccak256(bytes(symbol)) == keccak256("")) {
            symbol = _toString(source);
        }
    }

    function _extractSpecificData(address source, uint256 objectId) private view returns(bool supportsSpecificName, bool supportsSpecificSymbol, bool supportsSpecificDecimals) {
        IEthItemMainInterface nft = IEthItemMainInterface(source);
        try nft.name(objectId) returns(string memory value) {
            supportsSpecificName = keccak256(bytes(value)) != keccak256("");
        } catch {
        }
        try nft.symbol(objectId) returns(string memory value) {
            supportsSpecificSymbol = keccak256(bytes(value)) != keccak256("");
        } catch {
        }
        try nft.decimals(objectId) returns(uint256 value) {
            supportsSpecificDecimals = value > 1;
        } catch {
        }
    }

    function onERC721Received(
        address operator,
        address owner,
        uint256 objectId,
        bytes memory payload
    ) public virtual override returns (bytes4) {
        if(msg.sender == ENS_TOKEN_ADDRESS && keccak256(abi.encodePacked("transferENS")) == keccak256(payload)) {
            require(_isFromDFO(operator), "Unauthorized Action");
            IERC721(msg.sender).safeTransferFrom(address(this), _ensController, objectId, payload);
            return this.onERC721Received.selector;
        }
        address model = payload.length == 0 ? address(0) : abi.decode(payload, (address));
        uint256 version = model == address(0) ? 0 : IEthItemModelBase(model).modelVersion();
        IEthItemFactory currentFactory = IEthItemFactory(factory());
        if(model == address(0)) {
            (,version) = currentFactory.erc721WrapperModel();
        }
        address ethItem = _checkEthItem(msg.sender, version);
        if(ethItem == address(0)) {
            IKnowledgeBase currentKnowledgeBase = IKnowledgeBase(knowledgeBase());
            currentKnowledgeBase.setEthItem(ethItem = _createERC721Wrapper(currentFactory, msg.sender, model));
            currentKnowledgeBase.setWrapped(msg.sender, ethItem);
        }
        IERC721(msg.sender).safeTransferFrom(address(this), ethItem, objectId, "");
        IERC20 item = IEthItemMainInterface(ethItem).asInteroperable(objectId);
        item.transfer(owner, item.balanceOf(address(this)));
        return this.onERC721Received.selector;
    }

    function _checkEthItem(address source, uint256 version) private view returns(address ethItem) {
        for(uint256 i = 0; i < _knowledgeBases.length; i++) {
            ethItem = IKnowledgeBase(_knowledgeBases[i]).wrapper(source, version);
            if(ethItem != address(0)) {
                return ethItem;
            }
        }
    }

    function _createERC721Wrapper(IEthItemFactory currentFactory, address source, address modelAddress) private returns(address ethItem) {
        (string memory name, string memory symbol) = _extractNameAndSymbol(source);
        bytes memory modelInitPayload = abi.encodeWithSignature("init(address,string,string)", source, name, symbol);
        (ethItem,) = currentFactory.createWrappedERC721(modelAddress, modelInitPayload);
    }

    function createNative(address modelAddress, bytes memory modelInitCallPayload, string memory ens) public override
        returns (address newNativeAddress, bytes memory modelInitCallResponse) {
        (newNativeAddress, modelInitCallResponse) = IEthItemFactory(factory()).createNative(modelAddress, modelInitCallPayload);
        IKnowledgeBase(knowledgeBase()).setEthItem(newNativeAddress);
        if(_ensController != address(0)) {
            IENSController(_ensController).attachENS(newNativeAddress, ens);
        }
    }

    function createNative(bytes memory modelInitCallPayload, string memory ens) public override
        returns (address newNativeAddress, bytes memory modelInitCallResponse) {
        (newNativeAddress, modelInitCallResponse) = IEthItemFactory(factory()).createNative(address(0), modelInitCallPayload);
        IKnowledgeBase(knowledgeBase()).setEthItem(newNativeAddress);
        if(_ensController != address(0)) {
            IENSController(_ensController).attachENS(newNativeAddress, ens);
        }
    }

    function createERC20Wrapper(bytes memory modelInitPayload) public override byDFO
        returns (address newEthItemAddress, bytes memory modelInitCallResponse) {
        (newEthItemAddress, modelInitCallResponse) = IEthItemFactory(factory()).createWrappedERC20(modelInitPayload);
        IKnowledgeBase currentKnowledgeBase = IKnowledgeBase(knowledgeBase());
        currentKnowledgeBase.setEthItem(newEthItemAddress);
        currentKnowledgeBase.setERC20Wrapper(newEthItemAddress);
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
}