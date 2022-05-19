//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../model/IItemMainInterface.sol";
import "../model/IItemInteroperableInterface.sol";
import "@ethereansos/swissknife/contracts/dynamicMetadata/model/IDynamicUriResolver.sol";
import "@ethereansos/swissknife/contracts/factory/model/IFactory.sol";
import "../util/ERC1155CommonLibrary.sol";

contract ItemMainInterface is IItemMainInterface {

    bytes32 override public constant TYPEHASH_PERMIT = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    address override public interoperableInterfaceModel;
    address private _itemMainInterfaceSupportsInterfaceImplementer;

    mapping(bytes32 => Header) override public collection;
    mapping(uint256 => ItemData) override public item;
    mapping(address => mapping(address => bool)) public override isApprovedForAll;

    uint256 private _keyIndex;

    mapping(uint256 => uint256[]) private _items;
    uint256 private _itemsLength;
    mapping(uint256 => uint256) private _itemsIndexes;

    mapping(bytes32 => uint256[]) private _batchItems;
    mapping(bytes32 => mapping(uint256 => uint256)) private _batchAmounts;
    bytes32[] private _batchKeys;

    constructor(string memory _plainUri, address _dynamicUriResolver, bytes memory _interoperableInterfaceModel, bytes memory itemMainInterfaceSupportsInterfaceImplementerData) {
        plainUri = _plainUri;
        dynamicUriResolver = _dynamicUriResolver;
        address created;
        assembly {
            created := create(0, add(_interoperableInterfaceModel, 0x20), mload(_interoperableInterfaceModel))
        }
        interoperableInterfaceModel = created;
        created = address(0);
        assembly {
            created := create(0, add(itemMainInterfaceSupportsInterfaceImplementerData, 0x20), mload(itemMainInterfaceSupportsInterfaceImplementerData))
        }
        _itemMainInterfaceSupportsInterfaceImplementer = created;
        hostInitializer = msg.sender;
    }

    function supportsInterface(bytes4 interfaceId) external override view returns (bool) {
        return IERC165(_itemMainInterfaceSupportsInterfaceImplementer).supportsInterface(interfaceId);
    }

    function name() override external pure returns(string memory) {
        return "Items";
    }

    function name(uint256 itemId) override external view returns(string memory) {
        return item[itemId].header.name;
    }

    function symbol() override external pure returns(string memory) {
        return "I";
    }

    function symbol(uint256 itemId) override external view returns(string memory) {
        return item[itemId].header.symbol;
    }

    function decimals(uint256) override external pure returns(uint256) {
        return 18;
    }

    function decimals() external override pure returns(uint256) {
        return 18;
    }

    function collectionUri(bytes32 collectionId) override external view returns(string memory) {
        return _uri(collection[collectionId].uri, abi.encode(collectionId, 0));
    }

    function uri(uint256 itemId) override external view returns(string memory) {
        ItemData storage itemData = item[itemId];
        return _uri(itemData.header.uri, abi.encode(itemData.collectionId, itemId));
    }

    function setCollectionsMetadata(bytes32[] calldata collectionIds, Header[] calldata values) override external returns(Header[] memory oldValues) {
        oldValues = new Header[](values.length);
        for(uint256 i = 0; i < values.length; i++) {
            Header storage oldValue = collection[collectionIds[i]];
            require((oldValues[i] = oldValue).host == msg.sender, "Unauthorized");
            address newHost = (collection[collectionIds[i]] = _validateHeader(values[i], bytes32(0))).host;
            if(newHost != oldValues[i].host) {
                emit Collection(oldValues[i].host, newHost, collectionIds[i]);
            }
        }
    }

    function setItemsCollection(uint256[] calldata itemIds, bytes32[] calldata collectionIds) override external returns(bytes32[] memory oldCollectionIds) {
        oldCollectionIds = new bytes32[](itemIds.length);
        for(uint256 i = 0; i < itemIds.length; i++) {
            ItemData storage itemData = item[itemIds[i]];
            require(collection[oldCollectionIds[i] = itemData.collectionId].host == msg.sender, "Unauthorized");
            require(!_stringIsEmpty(collection[itemData.collectionId = collectionIds[i]].name), "collection");
            emit CollectionItem(oldCollectionIds[i], collectionIds[i], itemIds[i]);
        }
    }

    function setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values) override external returns(Header[] memory oldValues) {
        oldValues = new Header[](values.length);
        for(uint256 i = 0; i < values.length; i++) {
            ItemData storage itemData = item[itemIds[i]];
            oldValues[i] = itemData.header;
            require(collection[itemData.collectionId].host == msg.sender, "Unauthorized");
            itemData.header = _validateHeader(values[i], itemData.collectionId);
            if(keccak256(bytes(itemData.header.uri)) != keccak256(bytes(oldValues[i].uri))) {
                emit URI(itemData.header.uri, itemIds[i]);
            }
        }
    }

    function totalSupply(uint256 itemId) override external view returns(uint256) {
        return item[itemId].totalSupply;
    }

    function balanceOf(address account, uint256 id) override external view returns (uint256) {
        return item[id].balanceOf[account];
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) override external view returns (uint256[] memory balances) {
        balances = new uint256[](ids.length);
        for(uint256 i = 0; i < balances.length; i++) {
            balances[i] = item[ids[i]].balanceOf[accounts[i]];
        }
    }

    function allowance(address owner, address spender, uint256 itemId) override external view returns (uint256) {
        return isApprovedForAll[owner][spender] ? 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff : item[itemId].allowance[owner][spender];
    }

    function setApprovalForAll(address operator, bool approved) override external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function setApprovalForAllByCollectionHost(bytes32 collectionId, address account, address operator, bool approved) external override {
        require(msg.sender == collection[collectionId].host, "Unauthorized");
        isApprovedForAll[account][operator] = approved;
    }

    function interoperableOf(uint256 itemId) override external view returns(address) {
        return item[itemId].collectionId == bytes32(0) ? address(0) : address(uint160(itemId));
    }

    function safeTransferFrom(address from, address to, uint256 itemId, uint256 amount, bytes calldata data) override external {
        require(from != address(0), "Zero address");
        require(to != address(0), "Zero address");
        _mintTransferOrBurn(item[itemId], msg.sender, from, to, itemId, amount, true);
        ERC1155CommonLibrary.doSafeTransferAcceptanceCheck(msg.sender, from, to, itemId, amount, data);
    }

    function safeBatchTransferFrom(address from, address to, uint256[] calldata itemIds, uint256[] calldata amounts, bytes calldata data) override external {
        require(from != address(0), "Zero address");
        require(to != address(0), "Zero address");
        _mintTransferOrBurn(msg.sender, from, to, itemIds, amounts, false, true);
        ERC1155CommonLibrary.doSafeBatchTransferAcceptanceCheck(msg.sender, from, to, itemIds, amounts, data);
    }

    function burn(address account, uint256 itemId, uint256 amount) override external {
        burn(account, itemId, amount, "");
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts) override external {
        burnBatch(account, itemIds, amounts, "");
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory) override public {
        require(account != address(0), "Zero address");
        _mintTransferOrBurn(item[itemId], msg.sender, account, address(0), itemId, amount, true);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory) override public {
        require(account != address(0), "Zero address");
        _mintTransferOrBurn(msg.sender, account, address(0), itemIds, amounts, false, true);
    }

    function createCollection(Header calldata _collection, CreateItem[] calldata items) override external returns(bytes32 collectionId, uint256[] memory itemIds) {
        Header storage storageCollection = (collection[collectionId = _randomKey(_keyIndex++)] = _validateHeader(_collection, bytes32(0)));
        require(storageCollection.host != address(0) || items.length > 0, "Empty");
        emit Collection(address(0), storageCollection.host, collectionId);
        itemIds = _createOrMintItems(collectionId, items);
    }

    function mintItems(CreateItem[] calldata items) override external returns(uint256[] memory) {
        return _createOrMintItems(bytes32(0), items);
    }

    function approve(address account, address spender, uint256 amount, uint256 itemId) override external {
        ItemData storage itemData = msg.sender == account ? item[itemId] : _checkItemPermissionAndRetrieveData(itemId);
        require(spender != address(0), "approve to the zero address");
        itemData.allowance[account][spender] = amount;
        if(msg.sender != address(uint160(itemId))) {
            IItemInteroperableInterface(address(uint160(itemId))).emitEvent(true, false, abi.encode(account, spender, amount));
        }
    }

    function mintTransferOrBurn(bool isMulti, bytes calldata data) override external {
        if(isMulti) {
            _mintTransferOrBurn(data);
            return;
        }
        (address operator, address sender, address recipient, uint256 itemId, uint256 amount) = abi.decode(data, (address, address, address, uint256, uint256));
        _mintTransferOrBurn(_checkItemPermissionAndRetrieveData(itemId), operator, sender, recipient, itemId, amount, true);
    }

    function permit(uint256 itemId, address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) override external {
        require(block.timestamp <= deadline, "ERC20Permit: expired deadline");
        ItemData storage itemData = item[itemId];
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                itemData.domainSeparator,
                keccak256(abi.encode(TYPEHASH_PERMIT, owner, spender, value, itemData.nonces[owner]++, deadline))
            )
        );
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, 'INVALID_SIGNATURE');
        itemData.allowance[owner][spender] = value;
        if(msg.sender != address(uint160(itemId))) {
            IItemInteroperableInterface(address(uint160(itemId))).emitEvent(true, false, abi.encode(owner, spender, value));
        }
    }

    function nonces(address owner, uint256 itemId) external override view returns(uint256) {
        return item[itemId].nonces[owner];
    }

    function EIP712_PERMIT_DOMAINSEPARATOR_NAME_AND_VERSION() public override pure returns(string memory, string memory) {
        return ("Item", "1");
    }

    function _validateHeader(Header memory header, bytes32 collectionId) private view returns(Header memory) {
        require(!_stringIsEmpty(header.name = _stringIsEmpty(header.name) && collectionId != bytes32(0) ? collection[collectionId].name : header.name), "name");
        require(!_stringIsEmpty(header.symbol = _stringIsEmpty(header.symbol) && collectionId != bytes32(0) ? collection[collectionId].symbol : header.symbol), "symbol");
        require(!_stringIsEmpty(header.uri = _stringIsEmpty(header.uri) && collectionId != bytes32(0) ? collection[collectionId].uri : header.uri), "uri");
        header.host = collectionId != bytes32(0) ? address(0) : header.host;
        require(header.host == address(0) || IFactory(hostInitializer).deployer(header.host) != address(0), "Invalid Host");
        return header;
    }

    function _createOrMintItems(bytes32 createdCollectionId, CreateItem[] calldata items) private returns(uint256[] memory itemIds) {
        itemIds = new uint256[](items.length);
        for(uint256 i = 0; i < items.length; i++) {
            CreateItem memory itemToCreate = items[i];
            itemIds[i] = createdCollectionId != bytes32(0) ? 0 : itemToCreate.id;
            itemToCreate.collectionId = createdCollectionId != bytes32(0) ? createdCollectionId : itemToCreate.id != 0 ? item[itemToCreate.id].collectionId : itemToCreate.collectionId;
            require(createdCollectionId != bytes32(0) || (itemToCreate.collectionId != bytes32(0) && msg.sender == collection[itemToCreate.collectionId].host), "Unauthorized");
            if(itemIds[i] == 0) {
                address interoperableInterfaceAddress = _clone(interoperableInterfaceModel);
                IItemInteroperableInterface(interoperableInterfaceAddress).init();
                ItemData storage newItem = item[itemIds[i] = uint160(interoperableInterfaceAddress)];
                newItem.collectionId = itemToCreate.collectionId;
                newItem.header = _validateHeader(itemToCreate.header, itemToCreate.collectionId);
                (string memory domainSeparatorName, string memory domainSeparatorVersion) = EIP712_PERMIT_DOMAINSEPARATOR_NAME_AND_VERSION();
                newItem.domainSeparator = keccak256(
                    abi.encode(
                        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                        keccak256(bytes(domainSeparatorName)),
                        keccak256(bytes(domainSeparatorVersion)),
                        block.chainid,
                        address(uint160(itemIds[i]))
                    )
                );
                emit CollectionItem(bytes32(0), newItem.collectionId, itemIds[i]);
                emit URI(newItem.header.uri, itemIds[i]);
            }
            _mint(itemIds[i], itemToCreate.accounts, itemToCreate.amounts);
        }
    }

    function _mint(uint256 itemId, address[] memory accounts, uint256[] memory amounts) private {
        for(uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "mint to the zero address");
            _mintTransferOrBurn(address(0), address(0), accounts[i], itemId, amounts[i], false);
        }
        _emitMultiEventsAndClear();
    }

    function _mintTransferOrBurn(bytes memory data) private {
        bool batch;
        (batch, data) = abi.decode(data, (bool, bytes));
        if(batch) {
            _mintTransferOrBurnBatch(data);
        } else {
            (address[] memory origins, address[] memory senders, address[] memory recipients, uint256[] memory itemIds, uint256[] memory amounts) = abi.decode(data, (address[], address[], address[], uint256[], uint256[]));
            for(uint256 i = 0; i < itemIds.length; i++) {
                _mintTransferOrBurn(origins[i], senders[i], recipients[i], itemIds[i], amounts[i], true);
            }
        }
        _emitMultiEventsAndClear();
    }

    function _mintTransferOrBurnBatch(bytes memory data) private {
        bytes[] memory batches = abi.decode(data, (bytes[]));
        for(uint256 i = 0; i < batches.length; i++) {
            (address operator, address sender, address recipient, uint256[] memory itemIds, uint256[] memory amounts) = abi.decode(batches[i], (address, address, address, uint256[], uint256[]));
            _mintTransferOrBurn(operator, sender, recipient, itemIds, amounts, true, false);
        }
    }

    function _mintTransferOrBurn(address operator, address sender, address recipient, uint256[] memory itemIds, uint256[] memory amounts, bool check, bool launchEvents) private {
        for(uint256 i = 0; i < itemIds.length; i++) {
            _mintTransferOrBurn(operator, sender, recipient, itemIds[i], amounts[i], check);
        }
        if(launchEvents) {
            _emitMultiEventsAndClear();
        }
    }

    function _mintTransferOrBurn(address operator, address sender, address recipient, uint256 itemId, uint256 amount, bool check) private {
        if(amount == 0) {
            return;
        }
        uint256 tokenIndex = _itemsIndexes[itemId];
        uint256[] storage items = _items[tokenIndex];
        if(items.length == 0 || items[0] != itemId) {
            items = _items[tokenIndex = _itemsIndexes[itemId] = _itemsLength++];
            items.push(itemId);
        }
        items.push(uint160(sender));
        items.push(uint160(recipient));
        items.push(amount);

        bytes32 key = keccak256(abi.encodePacked(operator, sender, recipient));
        items = _batchItems[key];
        if(items.length == 0) {
            _batchKeys.push(key);
            items.push(uint160(operator));
            items.push(uint160(sender));
            items.push(uint160(recipient));
        }
        if(_batchAmounts[key][itemId] == 0) {
            items.push(itemId);
        }
        _batchAmounts[key][itemId] += amount;
        _mintTransferOrBurn(check ? _checkItemPermissionAndRetrieveData(itemId) : item[itemId], operator, sender, recipient, itemId, amount, false);
    }

    function _mintTransferOrBurn(ItemData storage itemData, address operator, address sender, address recipient, uint256 itemId, uint256 amount, bool launchEvent) private {
        if(sender != address(0)) {
            if(operator != sender) {
                require(itemData.allowance[sender][operator] >= amount || isApprovedForAll[sender][operator], "amount exceeds allowance");
                if(itemData.allowance[sender][operator] >= amount) {
                    itemData.allowance[sender][operator] -= amount;
                } else {
                    delete itemData.allowance[sender][operator];
                }
            }
            require(itemData.balanceOf[sender] >= amount, "amount exceeds balance");
            itemData.balanceOf[sender] -= amount;
        } else {
            itemData.totalSupply += amount;
        }
        if(recipient != address(0)) {
            itemData.balanceOf[recipient] += amount;
        } else {
            itemData.totalSupply -= amount;
        }
        if(launchEvent) {
            emit TransferSingle(operator, sender, recipient, itemId, amount);
            if(itemId != uint160(msg.sender)) {
                IItemInteroperableInterface(address(uint160(itemId))).emitEvent(false, false, abi.encode(sender, recipient, amount));
            }
        }
    }

    function _checkItemPermissionAndRetrieveData(uint256 itemId) private view returns (ItemData storage itemData) {
        require(collection[(itemData = item[itemId]).collectionId].host == msg.sender || uint160(msg.sender) == itemId, "Unauthorized");
    }

    function _stringIsEmpty(string memory test) private pure returns(bool) {
        return keccak256(bytes(test)) == keccak256("");
    }

    function _emitMultiEventsAndClear() private {
        for(uint256 i = 0; i < _itemsLength; i++) {
            uint256[] storage items = _items[i];
            uint256 itemId = items[0];
            delete items[0];
            uint256 length = (items.length - 1) / 3;
            address[] memory senders = new address[](length);
            address[] memory receivers = new address[](length);
            uint256[] memory amounts = new uint256[](length);
            uint256 inc = 0;
            for(uint256 z = 1; z < items.length; z += 3) {
                senders[inc] = address(uint160(items[z]));
                delete items[z];
                receivers[inc] = address(uint160(items[z + 1]));
                delete items[z + 1];
                amounts[inc++] = items[z + 2];
                delete items[z + 2];
            }
            IItemInteroperableInterface(address(uint160(itemId))).emitEvent(false, true, abi.encode(senders, receivers, amounts));
            delete _itemsIndexes[itemId];
            delete _items[i];
        }
        delete _itemsLength;
        _emitMultiEventsAndClearBatch();
    }

    function _emitMultiEventsAndClearBatch() private {
        for(uint256 i = 0; i < _batchKeys.length; i++) {
            bytes32 key = _batchKeys[i];
            uint256[] storage items = _batchItems[key];
            uint256 length = items.length - 3;
            address operator = address(uint160(items[0]));
            delete items[0];
            address sender = address(uint160(items[1]));
            delete items[1];
            address receiver = address(uint160(items[2]));
            delete items[2];
            uint256 inc = 0;
            uint256[] memory itemIds = new uint256[](length);
            uint256[] memory amounts = new uint256[](length);
            for(uint256 z = 3; z < items.length; z++) {
                amounts[inc] = _batchAmounts[key][itemIds[inc] = items[z]];
                delete items[z];
                delete _batchAmounts[key][inc++];
            }
            emit TransferBatch(operator, sender, receiver, itemIds, amounts);
            delete _batchItems[key];
        }
        delete _batchKeys;
    }

    address public override hostInitializer;
    string public override plainUri;
    address public override dynamicUriResolver;

    function uri() external override view returns(string memory) {
        return _uri(plainUri, "");
    }

    function _randomKey(uint256 i) private view returns (bytes32) {
        return keccak256(abi.encode(i, block.timestamp, block.number, tx.origin, tx.gasprice, block.coinbase, block.difficulty, msg.sender, blockhash(block.number - 5)));
    }

    function _clone(address originalContract) private returns(address copyContract) {
        assembly {
            mstore(
                0,
                or(
                    0x5880730000000000000000000000000000000000000000803b80938091923cF3,
                    mul(originalContract, 0x1000000000000000000)
                )
            )
            copyContract := create(0, 0, 32)
            switch extcodesize(copyContract)
                case 0 {
                    invalid()
                }
        }
    }

    function _uri(string memory _plainUri, bytes memory additionalData) internal view returns(string memory) {
        if(dynamicUriResolver == address(0)) {
            return _plainUri;
        }
        return IDynamicUriResolver(dynamicUriResolver).resolve(address(this), _plainUri, additionalData, msg.sender);
    }
}