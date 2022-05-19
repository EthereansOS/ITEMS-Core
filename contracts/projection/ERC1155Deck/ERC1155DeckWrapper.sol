//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IERC1155DeckWrapper.sol";
import "../ItemProjection.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { Uint256Utilities, StringUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

struct ReserveDataEntry {
    address unwrapper;
    uint256 timeout;
    uint256 amount;
}

library ERC1155DeckWrapperUtilities {
    using AddressUtilities for address;
    using StringUtilities for string;

    event ReserveData(address from, address indexed tokenAddress, uint256 indexed tokenId, uint256 amount, uint256 timeout, bytes32 indexed reserveDataKey);

    function buildCreateItem(mapping(bytes32 => ReserveDataEntry) storage _reserveData, address from, address tokenAddress, uint256 tokenId, uint256 amount, uint256 td, uint256 itemId, bytes memory data) external returns(CreateItem memory createItem, uint256 tokenDecimals) {

        tokenDecimals = itemId != 0 ? td : _safeDecimals(tokenAddress, tokenId);

        bool reserve;
        (data, reserve) = _extractAndElaborateValues(from, tokenAddress, amount, tokenDecimals, itemId, data);

        _reserve(_reserveData, reserve, from, tokenAddress, tokenId, amount, data);

        createItem = _finalizeCreation(tokenAddress, tokenId, itemId, data);
    }

    function unwrap(address mainInterface, uint256 tokenDecimals, address from, uint256 itemId, uint256 amount, bytes memory data) external view returns (
        address tokenAddress,
        uint256 tokenId,
        address receiver,
        bytes32[] memory reserveDataKeys,
        uint256 tokenAmount,
        uint256 interoperableAmount) {
        require(amount > 0, "zero");
        (tokenAddress, tokenId, receiver, reserveDataKeys, data) = abi.decode(data, (address, uint256, address, bytes32[], bytes));
        receiver = receiver != address(0) ? receiver : from;
        require(IERC1155DeckWrapper(address(this)).itemIdOf(tokenAddress, tokenId) == itemId, "token");
        uint256 converter = 10**(18 - tokenDecimals);
        tokenAmount = amount / converter;
        interoperableAmount = amount;
        require(interoperableAmount > 0);
        uint256 balanceOf = IItemMainInterface(mainInterface).balanceOf(from, itemId);
        require(balanceOf > 0 && balanceOf >= interoperableAmount, "insuff");
        uint256 totalSupply = IItemMainInterface(mainInterface).totalSupply(itemId);
        bool isUnity = interoperableAmount >= (51*1e16);
        if(totalSupply <= 1e18 && isUnity) {
            tokenAmount = 1;
        } else {
            require(amount == tokenAmount * converter, "amount");
        }
        require(tokenDecimals == 18 || totalSupply > 1e18 || isUnity, "balance");
    }

    function _reserve(mapping(bytes32 => ReserveDataEntry) storage _reserveData, bool reserve, address from, address tokenAddress, uint256 tokenId, uint256 amount, bytes memory data) private {
        require(amount > 0, "amount");
        if(reserve) {
            (data,,) = abi.decode(data, (bytes, address[], uint256[]));
            (,, uint256 reserveTimeInBlocks) = abi.decode(data, (bytes32, string, uint256));
            bytes32 reserveDataKey = _toReserveDataKey(from, tokenAddress, tokenId, amount);
            require(_reserveData[reserveDataKey].timeout == 0, 'already reserved');
            uint256 timeout = block.number + reserveTimeInBlocks;
            _reserveData[reserveDataKey] = ReserveDataEntry(from, timeout, amount);
            emit ReserveData(from, tokenAddress, tokenId, amount, timeout, reserveDataKey);
        } else {
            _reserveData[_toReserveDataKey(address(0), tokenAddress, tokenId, 0)].amount += amount;
        }
    }

    function _toReserveDataKey(address from, address tokenAddress, uint256 tokenId, uint256 amount) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(from, tokenAddress, tokenId, amount));
    }

    function _extractAndElaborateValues(address from, address tokenAddress, uint256 amount, uint256 tokenDecimals, uint256 itemId, bytes memory data) private view returns(bytes memory elaboratedData, bool reserve) {
        address mainInterface;
        (mainInterface, elaboratedData, data) = abi.decode(data, (address, bytes, bytes));
        require(tokenDecimals == 0 || tokenAddress == mainInterface, "unsupported");
        uint256[] memory values;
        address[] memory receivers;
        (values, receivers, reserve) = abi.decode(data, (uint256[], address[], bool));
        uint256 totalAmount;
        address[] memory realReceivers = new address[](values.length);
        for(uint256 i = 0; i < values.length; i++) {
            totalAmount += values[i];
            values[i] = _convertAmount(mainInterface, i, tokenDecimals, values[i], itemId);
            realReceivers[i] = (realReceivers[i] = i < receivers.length ? receivers[i] : from) != address(0) ? realReceivers[i] : from;
        }
        require(totalAmount == amount, "amount");
        elaboratedData = abi.encode(elaboratedData, realReceivers, values);
    }

    function _finalizeCreation(address tokenAddress, uint256 tokenId, uint256 itemId, bytes memory data) private view returns(CreateItem memory) {
        address[] memory receivers;
        uint256[] memory values;
        (data, receivers, values) = abi.decode(data, (bytes, address[], uint256[]));
        (bytes32 collectionId, string memory uri,) = abi.decode(data, (bytes32, string, uint256));
        (string memory name, string memory symbol) = itemId != 0 ? ("", "") : _tryRecoveryMetadata(tokenAddress, tokenId);
        name = itemId != 0 ? "" : string(abi.encodePacked(name, " Deck"));
        symbol = itemId != 0 ? "" : string(abi.encodePacked("D-", symbol));
        return CreateItem(Header(address(0), name, symbol, uri), collectionId, itemId, receivers, values);
    }

    function _convertAmount(address mainInterface, uint256 i, uint256 tokenDecimals, uint256 plainValue, uint256 itemId) private view returns(uint256) {
        uint256 totalSupply = itemId == 0 ? 0 : Item(mainInterface).totalSupply(itemId);
        if(i > 0 || tokenDecimals != 0 || itemId == 0 || (itemId != 0 && (totalSupply >= 1e18))) {
            return plainValue * (10**(18 - tokenDecimals));
        }
        return (1e18 - totalSupply) + ((plainValue - 1) * (10**(18 - tokenDecimals)));
    }

    function _tryRecoveryMetadata(address source, uint256 tokenId) private view returns(string memory name, string memory symbol) {
        ItemProjection nft = ItemProjection(source);
        try nft.name(tokenId) returns(string memory n) {
            name = n;
        } catch {
        }
        try nft.symbol(tokenId) returns(string memory s) {
            symbol = s;
        } catch {
        }
        if(name.isEmpty()) {
            try nft.name() returns(string memory n) {
                name = n;
            } catch {
            }
        }
        if(symbol.isEmpty()) {
            try nft.symbol() returns(string memory s) {
                symbol = s;
            } catch {
            }
        }
        if(name.isEmpty()) {
            name = source.toString();
        }
        if(symbol.isEmpty()) {
            symbol = source.toString();
        }
    }

    function _safeDecimals(address tokenAddress, uint256) private view returns(uint256 dec) {
        (bool result, bytes memory response) = tokenAddress.staticcall(abi.encodeWithSelector(0x313ce567));//decimals()
        if(result) {
            dec = abi.decode(response, (uint256));
        }
        require(dec == 0 || dec == 18, "dec");
    }
}

contract ERC1155DeckWrapper is IERC1155DeckWrapper, ItemProjection, IERC1155Receiver {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;
    using Uint256Utilities for uint256[];
    using BytesUtilities for bytes;
    using ERC1155DeckWrapperUtilities for mapping(bytes32 => ReserveDataEntry);

    mapping(bytes32 => uint256) private _itemIdOf;
    mapping(uint256 => uint256) private _tokenDecimals;

    mapping(uint256 => address) private _sourceTokenAddress;
    mapping(uint256 => bytes32) private _sourceTokenKey;

    uint256[] private _tokenIds;
    mapping(uint256 => bool) private _reserve;
    mapping(uint256 => uint256) private _originalAmount;
    mapping(uint256 => address[]) private _accounts;
    mapping(uint256 => uint256[]) private _originalAmounts;

    uint256 public override reserveTimeInBlocks;

    mapping(bytes32 => ReserveDataEntry) public override reserveData;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function _projectionLazyInit(bytes memory collateralInitData) internal override returns (bytes memory) {
        reserveTimeInBlocks = abi.decode(collateralInitData, (uint256));
        return "";
    }

    function itemIdOf(address tokenAddress, uint256 tokenId) override public view returns(uint256) {
        return _itemIdOf[_toItemKey(tokenAddress, tokenId)];
    }

    function source(uint256 itemId) external override view returns(address tokenAddress, bytes32 tokenKey) {
        return (_sourceTokenAddress[itemId], _sourceTokenKey[itemId]);
    }

    function mintItems(CreateItem[] calldata createItemsInput) virtual override(Item, ItemProjection) public returns(uint256[] memory itemIds) {
        return mintItems(createItemsInput, new bool[](0));
    }

    function mintItems(CreateItem[] calldata createItemsInput, bool[] memory reserveArray) override public returns(uint256[] memory itemIds) {
        require(createItemsInput.length > 0 && (reserveArray.length == 0 || createItemsInput.length == reserveArray.length), "input");
        uint256[] memory values = new uint256[](createItemsInput.length);
        uint256[] memory loadedItemIds = new uint256[](createItemsInput.length);
        itemIds = new uint256[](createItemsInput.length);
        string memory uri = plainUri();
        for(uint256 i = 0; i < createItemsInput.length; i++) {
            address tokenAddress = address(uint160(uint256(createItemsInput[i].collectionId)));
            uint256 tokenId = createItemsInput[i].id;
            uint256 value = createItemsInput[i].amounts.sum();
            values[i] = value;
            IERC1155(tokenAddress).safeTransferFrom(msg.sender, address(this), tokenId, value, "");
        }
        for(uint256 i = 0; i < createItemsInput.length; i++) {
            address tokenAddress = address(uint160(uint256(createItemsInput[i].collectionId)));
            uint256 tokenId = createItemsInput[i].id;
            uint256 value = values[i];
            bytes memory encodedData = abi.encode(createItemsInput[i].amounts, createItemsInput[i].accounts, i < reserveArray.length && reserveArray[i]);
            uint256 itemId = loadedItemIds[i] = itemIdOf(tokenAddress, tokenId);
            CreateItem[] memory createItems = new CreateItem[](1);
            uint256 tokenDecimals;
            (createItems[0], tokenDecimals) = _buildCreateItem(msg.sender, tokenAddress, tokenId, value, encodedData, itemId, uri);
            itemIds[i] = IItemMainInterface(mainInterface).mintItems(createItems)[0];
            if(loadedItemIds[i] == 0) {
                bytes32 itemKey = _toItemKey(tokenAddress, tokenId);
                _itemIdOf[itemKey] = itemIds[i];
                _tokenDecimals[itemIds[i]] = tokenDecimals;
                _sourceTokenAddress[itemIds[i]] = tokenAddress;
                _sourceTokenKey[itemIds[i]] = itemKey;
                loadedItemIds[i] = itemIds[i];
            }
            emit Token(tokenAddress, tokenId, loadedItemIds[i]);
        }
    }

    function _buildCreateItem(address from, address tokenAddress, uint256 tokenId, uint256 value, bytes memory encodedData, uint256 itemId, string memory uri) private returns (CreateItem memory, uint256) {
        require(_sourceTokenAddress[tokenId] == address(0) && _sourceTokenKey[tokenId] == bytes32(0), "invalid");
        return ERC1155DeckWrapperUtilities.buildCreateItem(reserveData, from, tokenAddress, tokenId, value, _tokenDecimals[itemId], itemId, abi.encode(mainInterface, abi.encode(collectionId, uri, reserveTimeInBlocks), encodedData));
    }

    function setHeader(Header calldata value) authorizedOnly override(IItemProjection, ItemProjection) external virtual returns(Header memory oldValue) {
        Header[] memory values = new Header[](1);
        values[0] = value;
        values[0].host = address(this);
        bytes32[] memory collectionIds = new bytes32[](1);
        collectionIds[0] = collectionId;
        return IItemMainInterface(mainInterface).setCollectionsMetadata(collectionIds, values)[0];
    }

    function setItemsCollection(uint256[] calldata, bytes32[] calldata) authorizedOnly virtual override(Item, ItemProjection) external returns(bytes32[] memory) {
        revert("Impossibru!");
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 tokenId,
        uint256 amount,
        bytes calldata data
    ) override external returns (bytes4) {
        if(operator == address(this)) {
            return this.onERC1155Received.selector;
        }
        uint256 itemId = itemIdOf(msg.sender, tokenId);
        (CreateItem memory createItem, uint256 tokenDecimals) = _buildCreateItem(from, msg.sender, tokenId, amount, data, itemId, plainUri());
        _trySaveCreatedItemAndEmitTokenEvent(itemId, 0, tokenId, createItem, tokenDecimals);
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes memory data
    ) override external returns (bytes4) {
        if(operator == address(this)) {
            return this.onERC1155BatchReceived.selector;
        }
        bytes[] memory dataArray = abi.decode(data, (bytes[]));
        for(uint256 i = 0 ; i < tokenIds.length; i++) {
            _prepareTempVars(from, tokenIds[i], amounts[i], dataArray[i]);
        }
        string memory uri = plainUri();
        for(uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            uint256 itemId = itemIdOf(msg.sender, tokenId);
            uint256 loadedItemId = itemId;
            CreateItem[] memory singleCreateItems = new CreateItem[](1);
            uint256 tokenDecimals;
            (singleCreateItems[0], tokenDecimals) = _buildCreateItem(from, msg.sender, tokenId, _originalAmount[tokenId], abi.encode(_originalAmounts[tokenId], _accounts[tokenId], _reserve[tokenId]), itemId, uri);
            itemId = IItemMainInterface(mainInterface).mintItems(singleCreateItems)[0];
            _trySaveCreatedItemAndEmitTokenEvent(loadedItemId, itemId, _tokenIds[i], singleCreateItems[0], tokenDecimals);
            delete _originalAmount[tokenId];
            delete _accounts[tokenId];
            delete _originalAmounts[tokenId];
            delete _reserve[tokenId];
            delete _tokenIds[i];
        }
        delete _tokenIds;
        return this.onERC1155BatchReceived.selector;
    }

    function unlockReserves(address[] calldata owners, address[] calldata tokenAddresses, uint256[] calldata tokenIds, uint256[] calldata amounts) external override {
        for(uint256 i = 0; i < owners.length; i++) {
            bytes32[] memory reserveDataKeys = new bytes32[](1);
            require(owners[i] != address(0), "address");
            require(amounts[i] > 0, "amount");
            reserveDataKeys[0] = keccak256(abi.encodePacked(owners[i], tokenAddresses[i], tokenIds[i], amounts[i]));
            require(reserveData[reserveDataKeys[0]].unwrapper != address(0), "reserve");
            _verifyReserve(reserveDataKeys, msg.sender, tokenAddresses[i], tokenIds[i], amounts[i], false);
        }
    }

    function _trySaveCreatedItemAndEmitTokenEvent(uint256 itemId, uint256 createdItemId, uint256 tokenId, CreateItem memory createItem, uint256 tokenDecimals) internal {
        if(createdItemId == 0) {
            CreateItem[] memory createItems = new CreateItem[](1);
            createItems[0] = createItem;
            createdItemId = IItemMainInterface(mainInterface).mintItems(createItems)[0];
        }
        if(itemId == 0) {
            bytes32 itemKey = _toItemKey(msg.sender, tokenId);
            _itemIdOf[itemKey] = createdItemId;
            _tokenDecimals[createdItemId] = tokenDecimals;
            _sourceTokenAddress[createdItemId] = msg.sender;
            _sourceTokenKey[createdItemId] = itemKey;
            itemId = createdItemId;
        }

        emit Token(msg.sender, tokenId, itemId);
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        require(account != address(0), "required account");
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, _unwrap(account, itemId, amount, data)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data) override(Item, ItemProjection) public {
        require(account != address(0), "required account");
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        bytes[] memory datas = abi.decode(data, (bytes[]));
        for(uint256 i = 0; i < itemIds.length; i++) {
            uint256 itemId = itemIds[i];
            interoperableInterfaceAmounts[i] = _unwrap(account, itemId, amounts[i], datas[i]);
            IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemIds[i], interoperableInterfaceAmounts[i]));
        }
        emit TransferBatch(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts);
    }

    function _unwrap(address account, uint256 itemId, uint256 amount, bytes memory data) private returns (uint256) {
        (address tokenAddress,
        uint256 tokenId,
        address receiver,
        bytes32[] memory reserveDataKeys,
        uint256 tokenAmount,
        uint256 interoperableAmount) = ERC1155DeckWrapperUtilities.unwrap(mainInterface, _tokenDecimals[itemId], account, itemId, amount, data);
        _verifyReserve(reserveDataKeys, account, tokenAddress, tokenId, tokenAmount, true);
        IERC1155(tokenAddress).safeTransferFrom(address(this), receiver, tokenId, tokenAmount, data);
        return interoperableAmount;
    }

    function _verifyReserve(bytes32[] memory reserveDataKeys, address from, address tokenAddress, uint256 tokenId, uint256 amount, bool unwrap) private {
        ReserveDataEntry storage totalAvailable = reserveData[keccak256(abi.encodePacked(address(0), tokenAddress, tokenId, uint256(0)))];
        for(uint256 i = 0; i < reserveDataKeys.length; i++) {
            bytes32 reserveDataKey = reserveDataKeys[i];
            ReserveDataEntry memory reserveDataElement = reserveData[reserveDataKey];
            if(reserveDataElement.unwrapper != address(0)) {
                require(reserveDataKey == keccak256(abi.encodePacked(reserveDataElement.unwrapper, tokenAddress, tokenId, reserveDataElement.amount)), "invalid reserve");
                require(reserveDataElement.unwrapper == from || block.number >= reserveDataElement.timeout, "Cannot unlock");
                totalAvailable.amount += reserveDataElement.amount;
                emit ReserveDataUnlocked(from, reserveDataKey, tokenAddress, tokenId, reserveDataElement.unwrapper, reserveDataElement.amount, reserveDataElement.timeout);
                delete reserveData[reserveDataKey];
            }
        }
        if(unwrap) {
            require(totalAvailable.amount >= amount, "Insufficient amount");
            totalAvailable.amount -= amount;
        }
    }

    function _prepareTempVars(address from, uint256 tokenId, uint256 amount, bytes memory data) private {
        (uint256[] memory amounts, address[] memory receivers, bool reserve) = abi.decode(data, (uint256[], address[], bool));
        uint256 originalAmount = 0;
        address[] memory accounts = receivers.length == 0 ? from.asSingletonArray() : receivers;
        require(accounts.length == amounts.length, "length");
        if(reserve) {
            _reserve[tokenId] = reserve;
        }
        for(uint256 z = 0; z < amounts.length; z++) {
            require(amounts[z] > 0, "zero amount");
            require(accounts[z] != address(0), "zero address");
            _originalAmounts[tokenId].push(amounts[z]);
            _accounts[tokenId].push(accounts[z]);
            originalAmount += amounts[z];
        }
        require(originalAmount == amount, "Not corresponding");
        if((_originalAmount[tokenId] += originalAmount) == originalAmount) {
            _tokenIds.push(tokenId);
        }
    }

    function _toItemKey(address tokenAddress, uint256 tokenId) private view returns(bytes32 key) {
        if(tokenAddress == mainInterface) {
            (key,,,) = IItemMainInterface(mainInterface).item(tokenId);
        } else {
            key = keccak256(abi.encodePacked(tokenAddress));
        }
    }
}