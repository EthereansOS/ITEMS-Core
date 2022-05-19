//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IERC20Wrapper.sol";
import "../ItemProjection.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import { Uint256Utilities, TransferUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

contract ERC20Wrapper is IERC20Wrapper, ItemProjection {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;
    using TransferUtilities for address;
    using BytesUtilities for bytes;

    mapping(address => uint256) public override itemIdOf;
    mapping(address => uint256) private _tokenDecimals;

    mapping(uint256 => address) public override source;

    address[] private _tokenAddresses;
    mapping(address => uint256) private _originalAmount;
    mapping(address => address[]) private _accounts;
    mapping(address => uint256[]) private _originalAmounts;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function mintItems(CreateItem[] calldata createItemsInput) virtual override(Item, ItemProjection) public returns(uint256[] memory) {
        return mintItemsWithPermit(createItemsInput, new bytes[](0));
    }

    function mintItemsWithPermit(CreateItem[] calldata createItemsInput, bytes[] memory permitSignatures) public override payable returns(uint256[] memory itemIds) {
        _prepareTempVars(createItemsInput, permitSignatures);
        (CreateItem[] memory createItems, uint256[] memory loadedItemIds) = _buildCreateItems();
        itemIds = IItemMainInterface(mainInterface).mintItems(createItems);
        for(uint256 i = 0; i < itemIds.length; i++) {
            if(loadedItemIds[i] == 0) {
                address tokenAddress = _tokenAddresses[i];
                itemIdOf[tokenAddress] = itemIds[i];
                source[itemIds[i]] = tokenAddress;
                emit Token(tokenAddress, itemIds[i]);
            }
            delete _tokenAddresses[i];
        }
        delete _tokenAddresses;
        itemIds = new uint256[](createItemsInput.length);
        for(uint256 i = 0; i < createItemsInput.length; i++) {
            itemIds[i] = itemIdOf[address(uint160(uint256(createItemsInput[i].collectionId)))];
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

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        require(account != address(0), "required account");
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, toInteroperableInterfaceAmount(amount, itemId, account)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
        _unwrap(account, itemId, amount, data);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data) override(Item, ItemProjection) public {
        require(account != address(0), "required account");
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], account);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(true, abi.encode(abi.encode(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts).asSingletonArray())));
        emit TransferBatch(msg.sender, account, address(0), itemIds, amounts);
        bytes[] memory datas = abi.decode(data, (bytes[]));
        for(uint256 i = 0; i < itemIds.length; i++) {
            _unwrap(account, itemIds[i], amounts[i], datas[i]);
        }
    }

    function _unwrap(address from, uint256 itemId, uint256 amount, bytes memory data) private {
        (address tokenAddress, address receiver) = abi.decode(data, (address, address));
        receiver = receiver != address(0) ? receiver : from;
        require(itemIdOf[tokenAddress] == itemId, "Wrong ERC20");
        uint256 converter = 10**(18 - _tokenDecimals[tokenAddress]);
        uint256 tokenAmount = amount / converter;
        uint256 rebuiltAmount = tokenAmount * converter;
        require(amount == rebuiltAmount, "Insufficient amount");
        tokenAddress.safeTransfer(receiver, tokenAmount);
    }

    function _buildCreateItem(address tokenAddress, uint256[] memory amounts, address[] memory receivers, uint256 itemId, string memory uri) private returns(CreateItem memory) {
        string memory name = itemId != 0 ? "" : string(abi.encodePacked(tokenAddress == address(0) ? "Ethereum" : _stringValue(tokenAddress, "name()", "NAME()"), " item"));
        string memory symbol = itemId != 0 ? "" : string(abi.encodePacked("i", tokenAddress == address(0) ? "ETH" : _stringValue(tokenAddress, "symbol()", "SYMBOL()")));
        uint256 tokenDecimals = (_tokenDecimals[tokenAddress] = itemId != 0 ? _tokenDecimals[tokenAddress] : tokenAddress == address(0) ? 18 : IERC20Metadata(tokenAddress).decimals());
        for(uint256 i = 0; i < amounts.length; i++) {
            amounts[i] = (amounts[i] * (10**(18 - tokenDecimals)));
        }
        return CreateItem(Header(address(0), name, symbol, uri), collectionId, itemId, receivers, amounts);
    }

    function _prepareTempVars(CreateItem[] calldata createItemsInput, bytes[] memory permitSignatures) private {
        for(uint256 i = 0; i < createItemsInput.length; i++) {
            address tokenAddress = address(uint160(uint256(createItemsInput[i].collectionId)));
            uint256 originalAmount = 0;
            address[] memory accounts = createItemsInput[i].accounts.length == 0 ? msg.sender.asSingletonArray() : createItemsInput[i].accounts;
            uint256[] memory amounts = createItemsInput[i].amounts;
            require(accounts.length == amounts.length, "length");
            for(uint256 z = 0; z < amounts.length; z++) {
                require(amounts[z] > 0, "zero amount");
                require(accounts[z] != address(0), "zero address");
                _originalAmounts[tokenAddress].push(amounts[z]);
                _accounts[tokenAddress].push(accounts[z]);
                originalAmount += amounts[z];
            }
            if((_originalAmount[tokenAddress] += originalAmount) == originalAmount) {
                _tokenAddresses.push(tokenAddress);
            }
            _tryPermit(tokenAddress, originalAmount, i < permitSignatures.length ? permitSignatures[i] : bytes(""));
        }
    }

    function _tryPermit(address erc20TokenAddress, uint256 amount, bytes memory permitSignature) private {
        if(erc20TokenAddress == address(0) || permitSignature.length == 0) {
            return;
        }
        (uint8 v, bytes32 r, bytes32 s, uint256 deadline) = abi.decode(permitSignature, (uint8, bytes32, bytes32, uint256));
        return IERC20Permit(erc20TokenAddress).permit(msg.sender, address(this), amount, deadline, v, r, s);
    }

    function _buildCreateItems() private returns(CreateItem[] memory createItems, uint256[] memory loadedItemIds) {
        createItems = new CreateItem[](_tokenAddresses.length);
        loadedItemIds = new uint256[](_tokenAddresses.length);
        string memory uri = plainUri();
        for(uint256 i = 0; i < _tokenAddresses.length; i++) {
            address tokenAddress = _tokenAddresses[i];
            uint256 originalAmount = _originalAmount[tokenAddress];
            uint256[] memory amounts = _originalAmounts[tokenAddress]; 
            if(tokenAddress == address(0)) {
                require(originalAmount == msg.value, "ETH");
            } else {
                uint256 previousBalance = IERC20(tokenAddress).balanceOf(address(this));
                tokenAddress.safeTransferFrom(msg.sender, address(this), originalAmount);
                uint256 realAmount = IERC20(tokenAddress).balanceOf(address(this)) - previousBalance;
                if(realAmount != originalAmount) {
                    require(amounts.length == 1, "Only single transfers allowed for this token");
                    amounts[0] = realAmount;
                }
            }
            createItems[i] = _buildCreateItem(tokenAddress, amounts, _accounts[tokenAddress], loadedItemIds[i] = itemIdOf[tokenAddress], uri);
            delete _originalAmount[tokenAddress];
            delete _accounts[tokenAddress];
            delete _originalAmounts[tokenAddress];
        }
    }

    function _stringValue(address erc20TokenAddress, string memory firstTry, string memory secondTry) private view returns(string memory) {
        (bool success, bytes memory data) = erc20TokenAddress.staticcall{ gas: 20000 }(abi.encodeWithSignature(firstTry));
        if (!success) {
            (success, data) = erc20TokenAddress.staticcall{ gas: 20000 }(abi.encodeWithSignature(secondTry));
        }

        if (success && data.length >= 96) {
            (uint256 offset, uint256 len) = abi.decode(data, (uint256, uint256));
            if (offset == 0x20 && len > 0 && len <= 256) {
                return string(abi.decode(data, (bytes)));
            }
        }

        if (success && data.length == 32) {
            uint len = 0;
            while (len < data.length && data[len] >= 0x20 && data[len] <= 0x7E) {
                len++;
            }

            if (len > 0) {
                bytes memory result = new bytes(len);
                for (uint i = 0; i < len; i++) {
                    result[i] = data[i];
                }
                return string(result);
            }
        }

        return erc20TokenAddress.toString();
    }
}