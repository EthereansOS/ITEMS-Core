//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IERC721DeckWrapper.sol";
import "../ItemProjection.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { Uint256Utilities, TransferUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "@ethereansos/swissknife/contracts/environment/ethereum/BlockRetriever.sol";

contract ERC721DeckWrapper is IERC721DeckWrapper, ItemProjection, IERC721Receiver, BlockRetriever {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;
    using BytesUtilities for bytes;
    using TransferUtilities for address;

    mapping(address => uint256) public override itemIdOf;

    mapping(uint256 => address) private _sourceTokenAddress;

    uint256 public override reserveTimeInBlocks;

    struct ReserveData {
        address unwrapper;
        uint256 timeout;
    }

    mapping(bytes32 => ReserveData) private _reserveData;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function _projectionLazyInit(bytes memory collateralInitData) internal override returns (bytes memory) {
        reserveTimeInBlocks = abi.decode(collateralInitData, (uint256));
        return "";
    }

    function reserveData(address tokenAddress, uint256 tokenId) external override view returns(address unwrapper, uint256 timeout) {
        ReserveData memory data = _reserveData[_toReserveDataKey(tokenAddress, tokenId)];
        unwrapper = data.unwrapper;
        timeout = data.timeout;
    }

    function source(uint256 itemId) external override view returns(address tokenAddress) {
        return (_sourceTokenAddress[itemId]);
    }

    function mintItems(CreateItem[] calldata createItemsInput) virtual override(Item, ItemProjection) public returns(uint256[] memory itemIds) {
        return mintItems(createItemsInput, new bool[](0));
    }

    function mintItems(CreateItem[] calldata createItemsInput, bool[] memory reserveArray) override public returns(uint256[] memory itemIds) {
        require(createItemsInput.length > 0 && (reserveArray.length == 0 || createItemsInput.length == reserveArray.length), "input");
        uint256[] memory loadedItemIds = new uint256[](createItemsInput.length);
        itemIds = new uint256[](createItemsInput.length);
        string memory uri = plainUri();
        for(uint256  i = 0; i < createItemsInput.length; i++) {
            address tokenAddress = address(uint160(uint256(createItemsInput[i].collectionId)));
            uint256 tokenId = createItemsInput[i].id;
            IERC721(tokenAddress).transferFrom(msg.sender, address(this), tokenId);
        }
        for(uint256  i = 0; i < createItemsInput.length; i++) {
            address tokenAddress = address(uint160(uint256(createItemsInput[i].collectionId)));
            uint256 tokenId = createItemsInput[i].id;
            CreateItem[] memory createItems = new CreateItem[](1);
            createItems[0] = _buildCreateItem(msg.sender, tokenAddress, createItemsInput[i].accounts, createItemsInput[i].amounts, loadedItemIds[i] = itemIdOf[tokenAddress], uri);
            if(i < reserveArray.length && reserveArray[i]) {
                _reserveData[_toReserveDataKey(tokenAddress, tokenId)] = ReserveData(msg.sender, _blockNumber() + reserveTimeInBlocks);
            }
            itemIds[i] = IItemMainInterface(mainInterface).mintItems(createItems)[0];
            if(loadedItemIds[i] == 0) {
                itemIdOf[tokenAddress] = itemIds[i];
                _sourceTokenAddress[itemIds[i]] = tokenAddress;
                loadedItemIds[i] = itemIds[i];
            }
            emit Token(tokenAddress, tokenId, loadedItemIds[i]);
        }
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

    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) override external returns (bytes4) {
        uint256[] memory values;
        address[] memory receivers;
        bool reserve;
        if(data.length > 0) {
            (values, receivers, reserve) = abi.decode(data, (uint256[], address[], bool));
        }
        if(reserve) {
            _reserveData[_toReserveDataKey(msg.sender, tokenId)] = ReserveData(from, _blockNumber() + reserveTimeInBlocks);
        }
        uint256 itemId = itemIdOf[msg.sender];
        CreateItem[] memory createItems = new CreateItem[](1);
        createItems[0] = _buildCreateItem(from, msg.sender, receivers, values, itemId, plainUri());
        uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(createItems)[0];
        if(itemId == 0) {
            itemIdOf[msg.sender] = createdItemId;
            _sourceTokenAddress[createdItemId] = msg.sender;
            itemId = createdItemId;
        }
        emit Token(msg.sender, tokenId, itemId);
        return this.onERC721Received.selector;
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        require(account != address(0), "required account");
        uint256 amountToBurn = toInteroperableInterfaceAmount(amount, itemId, account);
        _unwrap(account, itemId, amountToBurn, data);
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, amountToBurn));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data) override(Item, ItemProjection) public {
        require(account != address(0), "required account");
        bytes[] memory datas = abi.decode(data, (bytes[]));
        for(uint256 i = 0 ; i < datas.length; i++) {
            uint256 itemId = itemIds[i];
            uint256 amount = amounts[i];
            uint256 amountToBurn = toInteroperableInterfaceAmount(amount, itemId, account);
            _unwrap(account, itemId, amountToBurn, datas[i]);
            IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, amountToBurn));
        }
        emit TransferBatch(msg.sender, account, address(0), itemIds, amounts);
    }

    function unlockReserves(address[] calldata tokenAddresses, uint256[] calldata tokenIds) external override {
        for(uint256 i = 0; i < tokenAddresses.length; i++) {
            _verifyReserve(tokenAddresses[i], tokenIds[i], msg.sender);
        }
    }

    function _unwrap(address from, uint256 itemId, uint256 amount, bytes memory data) private {
        require(amount > 0, "zero");
        (address tokenAddress, uint256 tokenId, address receiver, bytes memory payload, bool safe, bool withData) = abi.decode(data, (address, uint256, address, bytes, bool, bool));
        receiver = receiver != address(0) ? receiver : from;
        require(itemIdOf[tokenAddress] == itemId, "Wrong ERC721");
        IERC721 token = IERC721(tokenAddress);
        require(token.ownerOf(tokenId) == address(this), "Invalid Token ID");
        _verifyReserve(tokenAddress, tokenId, from);
        uint256 totalSupply = Item(mainInterface).totalSupply(itemId);
        if(totalSupply > 1e18) {
            require(amount == 1e18, "Invalid amount");
        } else {
            require(amount >= (51*1e16), "Invalid amount");
        }
        if(!safe) {
            try token.transferFrom(address(this), receiver, tokenId) {
            } catch {
                tokenAddress.safeTransfer(receiver, tokenId);
            }
            return;
        }
        if(withData) {
            token.safeTransferFrom(address(this), receiver, tokenId, payload);
            return;
        }
        token.safeTransferFrom(address(this), receiver, tokenId);
    }

    function _buildCreateItem(address from, address tokenAddress, address[] memory receivers, uint256[] memory values, uint256 itemId, string memory uri) private view returns(CreateItem memory) {
        (string memory name, string memory symbol) = itemId != 0 ? ("", "") : _tryRecoveryMetadata(tokenAddress);
        name = itemId != 0 ? "" : string(abi.encodePacked(name, " Deck"));
        symbol = itemId != 0 ? "" : string(abi.encodePacked("D-", symbol));
        uint256 supplyToMint = itemId == 0 ? 0 : IItemMainInterface(mainInterface).totalSupply(itemId);
        supplyToMint = 1e18 - (supplyToMint < 1e18 ? supplyToMint : 0);
        address[] memory accounts = receivers.length == 0 ? from.asSingletonArray() : receivers;
        uint256[] memory amounts = values.length == 0 ? supplyToMint.asSingletonArray() : values;
        require(accounts.length == amounts.length, "length");
        for(uint256 i = 0; i < amounts.length; i++) {
            require(accounts[i] != address(0), "zero address");
            require(supplyToMint >= amounts[i], "amount");
            supplyToMint -= amounts[i];
        }
        require(supplyToMint == 0, "amount");
        return CreateItem(Header(address(0), name, symbol, itemId != 0 ? "" : uri), collectionId, itemId, accounts, amounts);
    }

    function _tryRecoveryMetadata(address source) private view returns(string memory name, string memory symbol) {
        IERC721Metadata nft = IERC721Metadata(source);
        try nft.name() returns(string memory n) {
            name = n;
        } catch {
        }
        try nft.symbol() returns(string memory s) {
            symbol = s;
        } catch {
        }
        if(keccak256(bytes(name)) == keccak256("")) {
            name = source.toString();
        }
        if(keccak256(bytes(symbol)) == keccak256("")) {
            symbol = source.toString();
        }
    }

    function _verifyReserve(address tokenAddress, uint256 tokenId, address from) private {
        bytes32 reserveDataKey = _toReserveDataKey(tokenAddress, tokenId);
        ReserveData memory reserveDataElement = _reserveData[reserveDataKey];
        if(reserveDataElement.unwrapper != address(0)) {
            require(reserveDataElement.unwrapper == from || _blockNumber() >= reserveDataElement.timeout, "Cannot unlock");
            delete _reserveData[reserveDataKey];
        }
    }

    function _toReserveDataKey(address tokenAddress, uint256 tokenId) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenAddress, tokenId));
    }
}