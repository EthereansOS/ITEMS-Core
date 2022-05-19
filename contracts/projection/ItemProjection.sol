//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IItemProjection.sol";
import "../model/IItemMainInterface.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "../util/ERC1155CommonLibrary.sol";
import { AddressUtilities, BytesUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

abstract contract ItemProjection is IItemProjection, LazyInitCapableElement {
    using AddressUtilities for address;
    using BytesUtilities for bytes;

    address public override mainInterface;
    bytes32 public override collectionId;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitParams) override virtual internal returns(bytes memory lazyInitResponse) {
        (mainInterface, lazyInitResponse) = abi.decode(lazyInitParams, (address, bytes));
        Header memory header;
        CreateItem[] memory items;
        (collectionId, header, items, lazyInitResponse) = abi.decode(lazyInitResponse, (bytes32, Header, CreateItem[], bytes));
        if(collectionId == bytes32(0)) {
            header.host = address(this);
            (collectionId,) = IItemMainInterface(mainInterface).createCollection(header, items);
        } else if(items.length > 0) {
            IItemMainInterface(mainInterface).mintItems(items);
        }
        lazyInitResponse = _projectionLazyInit(lazyInitResponse);
    }

    function _supportsInterface(bytes4 interfaceId) override internal pure returns (bool) {
        return
            interfaceId == type(IItemProjection).interfaceId ||
            interfaceId == 0xeac989f8 ||//uri()
            interfaceId == this.mainInterface.selector ||
            interfaceId == this.collectionId.selector ||
            interfaceId == this.plainUri.selector ||
            interfaceId == this.itemPlainUri.selector ||
            interfaceId == this.setHeader.selector ||
            interfaceId == this.toInteroperableInterfaceAmount.selector ||
            interfaceId == this.toMainInterfaceAmount.selector ||
            interfaceId == this.balanceOf.selector ||
            interfaceId == this.balanceOfBatch.selector ||
            interfaceId == this.setApprovalForAll.selector ||
            interfaceId == this.isApprovedForAll.selector ||
            interfaceId == this.safeTransferFrom.selector ||
            interfaceId == this.safeBatchTransferFrom.selector ||
            interfaceId == 0xd9b67a26 ||//OpenSea Standard
            interfaceId == type(IERC1155Views).interfaceId ||
            interfaceId == this.totalSupply.selector ||
            interfaceId == 0x00ad800c ||//name(uint256)
            interfaceId == 0x4e41a1fb ||//symbol(uint256)
            interfaceId == 0x3f47e662 ||//decimals(uint256)
            interfaceId == 0x313ce567 ||//decimals()
            interfaceId == 0x0e89341c ||//uri(uint256)
            interfaceId == type(Item).interfaceId ||
            interfaceId == 0x06fdde03 ||//name()
            interfaceId == 0x95d89b41 ||//symbol()
            interfaceId == 0xf5298aca ||//burn(address,uint256,uint256)
            interfaceId == 0x6b20c454 ||//burnBatch(address,uint256[],uint256[])
            interfaceId == 0x8a94b05f ||//burn(address,uint256,uint256,bytes)
            interfaceId == 0x5473422e ||//burnBatch(address,uint256[],uint256[],bytes)
            interfaceId == this.mintItems.selector ||
            interfaceId == this.setItemsCollection.selector ||
            interfaceId == this.setItemsMetadata.selector ||
            interfaceId == this.interoperableOf.selector;
    }

    function _projectionLazyInit(bytes memory) internal virtual returns (bytes memory) {
        return "";
    }

    function setHeader(Header calldata value) authorizedOnly override external virtual returns(Header memory oldValue) {
        Header[] memory values = new Header[](1);
        values[0] = value;
        bytes32[] memory collectionIds = new bytes32[](1);
        collectionIds[0] = collectionId;
        return IItemMainInterface(mainInterface).setCollectionsMetadata(collectionIds, values)[0];
    }

    function setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values) authorizedOnly override external virtual returns(Header[] memory oldValues) {
        return IItemMainInterface(mainInterface).setItemsMetadata(itemIds, values);
    }

    function mintItems(CreateItem[] memory items) authorizedOnly virtual override public returns(uint256[] memory itemIds) {
        uint256 multiplier = 10 ** (18 - decimals(0));
        for(uint256 i = 0; i < items.length; i++) {
            items[i].collectionId = collectionId;
            uint256[] memory amounts = items[i].amounts;
            for(uint256 z = 0; z < amounts.length; z++) {
                amounts[z] = amounts[z] * multiplier;
            }
            items[i].amounts = amounts;
        }
        return IItemMainInterface(mainInterface).mintItems(items);
    }

    function setItemsCollection(uint256[] calldata itemIds, bytes32[] calldata collectionIds) authorizedOnly virtual override external returns(bytes32[] memory oldCollectionIds) {
        return IItemMainInterface(mainInterface).setItemsCollection(itemIds, collectionIds);
    }

    function name() override external view returns(string memory value) {
        (,value,,) = IItemMainInterface(mainInterface).collection(collectionId);
    }

    function symbol() override external view returns(string memory value) {
        (,,value,) = IItemMainInterface(mainInterface).collection(collectionId);
    }

    function plainUri() override public view returns(string memory value) {
        (,,,value) = IItemMainInterface(mainInterface).collection(collectionId);
    }

    function uri() override public view returns(string memory) {
        return IItemMainInterface(mainInterface).collectionUri(collectionId);
    }

    function interoperableOf(uint256 itemId) override public pure returns(address) {
        return address(uint160(itemId));
    }

    function name(uint256 itemId) override external view returns(string memory) {
        (,Header memory header,,) = IItemMainInterface(mainInterface).item(itemId);
        return header.name;
    }

    function symbol(uint256 itemId) override external view returns(string memory) {
        (,Header memory header,,) = IItemMainInterface(mainInterface).item(itemId);
        return header.symbol;
    }

    function decimals(uint256) override public virtual view returns(uint256) {
        return 18;
    }

    function decimals() external override view returns(uint256) {
        return 18;
    }

    function toMainInterfaceAmount(uint256 interoperableInterfaceAmount, uint256 itemId) override public view returns(uint256) {
        if(interoperableInterfaceAmount == 0) {
            return 0;
        }
        uint256 itemDecimals = decimals(itemId);
        if(itemDecimals == 18) {
            return interoperableInterfaceAmount;
        }
        uint256 interoperableTotalSupply = IERC20(interoperableOf(itemId)).totalSupply();
        uint256 interoperableUnity = 1e18;
        uint256 interoperableHalfUnity = (interoperableUnity / 51) * 100;
        uint256 mainInterfaceUnity = 10 ** itemDecimals;
        if(interoperableTotalSupply <= interoperableUnity && interoperableInterfaceAmount <= interoperableUnity) {
            return interoperableInterfaceAmount < interoperableHalfUnity ? 0 : mainInterfaceUnity;
        }
        return (interoperableInterfaceAmount * mainInterfaceUnity) / interoperableUnity;
    }

    function toInteroperableInterfaceAmount(uint256 mainInterfaceAmount, uint256 itemId, address account) override public view returns(uint256) {
        if(mainInterfaceAmount == 0) {
            return 0;
        }
        if(decimals(itemId) == 18) {
            return mainInterfaceAmount;
        }
        uint256 interoperableInterfaceAmount = mainInterfaceAmount * 10 ** (18 - decimals(itemId));
        if(account == address(0)) {
            return interoperableInterfaceAmount;
        }
        uint256 interoperableBalance = IItemMainInterface(mainInterface).balanceOf(account, itemId);
        if(interoperableBalance == 0) {
            return interoperableInterfaceAmount;
        }
        uint256 interoperableTotalSupply = IERC20(interoperableOf(itemId)).totalSupply();
        uint256 interoperableUnity = 1e18;
        uint256 interoperableHalfUnity = (interoperableUnity / 51) * 100;
        if(interoperableTotalSupply <= interoperableUnity && interoperableInterfaceAmount == interoperableUnity && interoperableBalance >= interoperableHalfUnity) {
            return interoperableBalance < interoperableInterfaceAmount ? interoperableBalance : interoperableInterfaceAmount;
        }
        return interoperableInterfaceAmount;
    }

    function uri(uint256 itemId) override external view returns(string memory) {
        return IItemMainInterface(mainInterface).uri(itemId);
    }

    function itemPlainUri(uint256 itemId) override external view returns(string memory) {
        (, Header memory header,,) = IItemMainInterface(mainInterface).item(itemId);
        return header.uri;
    }

    function totalSupply(uint256 itemId) override external view returns (uint256) {
        return IItemMainInterface(mainInterface).totalSupply(itemId);
    }

    function balanceOf(address account, uint256 itemId) override external view returns (uint256) {
        return toMainInterfaceAmount(IItemMainInterface(mainInterface).balanceOf(account, itemId), itemId);
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata itemIds) override external view returns (uint256[] memory balances) {
        balances = IItemMainInterface(mainInterface).balanceOfBatch(accounts, itemIds);
        for(uint256 i = 0; i < itemIds.length; i++) {
            balances[i] = toMainInterfaceAmount(balances[i], itemIds[i]);
        }
    }

    function isApprovedForAll(address account, address operator) override external view returns (bool) {
        return IItemMainInterface(mainInterface).isApprovedForAll(account, operator);
    }

    function setApprovalForAll(address operator, bool approved) override external virtual {
        IItemMainInterface(mainInterface).setApprovalForAllByCollectionHost(collectionId, msg.sender, operator, approved);
    }

    function safeTransferFrom(address from, address to, uint256 itemId, uint256 amount, bytes calldata data) override external virtual {
        require(from != address(0), "required from");
        require(to != address(0), "required to");
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, from, to, itemId, toInteroperableInterfaceAmount(amount, itemId, from)));
        ERC1155CommonLibrary.doSafeTransferAcceptanceCheck(msg.sender, from, to, itemId, amount, data);
        emit TransferSingle(msg.sender, from, to, itemId, amount);
    }

    function safeBatchTransferFrom(address from, address to, uint256[] calldata itemIds, uint256[] calldata amounts, bytes calldata data) override external virtual {
        require(from != address(0), "required from");
        require(to != address(0), "required to");
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], from);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(true, abi.encode(abi.encode(msg.sender, from, to, itemIds, interoperableInterfaceAmounts).asSingletonArray())));
        ERC1155CommonLibrary.doSafeBatchTransferAcceptanceCheck(msg.sender, from, to, itemIds, amounts, data);
        emit TransferBatch(msg.sender, from, to, itemIds, amounts);
    }

    function burn(address account, uint256 itemId, uint256 amount) override external {
        burn(account, itemId, amount, "");
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts) override external {
        burnBatch(account, itemIds, amounts, "");
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory) override virtual public {
        require(account != address(0), "required account");
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, toInteroperableInterfaceAmount(amount, itemId, account)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory) override virtual public {
        require(account != address(0), "required account");
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], account);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(true, abi.encode(abi.encode(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts).asSingletonArray())));
        emit TransferBatch(msg.sender, account, address(0), itemIds, amounts);
    }
}