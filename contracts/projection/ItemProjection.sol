//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IItemProjection.sol";
import "../model/IItemMainInterface.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "../util/ERC1155CommonLibrary.sol";

abstract contract ItemProjection is IItemProjection, LazyInitCapableElement {

    address public override mainInterface;
    bytes32 public override collectionId;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes calldata initParams) override internal returns(bytes memory) {
        (address _mainInterface, bytes32 _collectionId, Header memory header, CreateItem[] memory items, bytes memory collateralInitData) = abi.decode(initParams, (address, bytes32, Header, CreateItem[], bytes));
        mainInterface = _mainInterface;
        collectionId = _collectionId;
        if(collectionId == 0) {
            IItemMainInterface(mainInterface).createCollection(header, items);
        } else {
            IItemMainInterface(mainInterface).mintItems(items);
        }
        return _projectionLazyInit(collateralInitData);
    }

    function _supportsInterface(bytes4 interfaceId) override internal view returns (bool) {
        //TODO SupportsInterface
    }

    function _projectionLazyInit(bytes memory lazyInitData) internal virtual returns (bytes memory collateralInitResponse);

    function setMainInterface(address value) authorizedOnly override external returns(address oldValue) {
        oldValue = mainInterface;
        mainInterface = value;
    }

    function setHeader(Header calldata value) authorizedOnly override external returns(Header memory oldValue) {
        Header[] memory values = new Header[](1);
        values[0] = value;
        bytes32[] memory collectionIds = new bytes32[](1);
        collectionIds[0] = collectionId;
        return IItemMainInterface(mainInterface).setCollectionsMetadata(collectionIds, values)[0];
    }

    function setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values) authorizedOnly override external returns(Header[] memory oldValues) {
        return IItemMainInterface(mainInterface).setItemsMetadata(itemIds, values);
    }

    function mintItems(CreateItem[] calldata items) authorizedOnly virtual override external returns(uint256[] memory itemIds) {
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

    function uri() override external view returns(string memory) {
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

    function decimals(uint256) virtual override public view returns(uint256) {
        return 18;
    }

    function toMainInterfaceAmount(uint256 amount, uint256 itemId) override public view returns(uint256) {
        if(amount == 0) {
            return 0;
        }
        if(decimals(itemId) == 18) {
            return amount;
        }
        uint256 interoperableTotalSupply = IERC20(interoperableOf(itemId)).totalSupply();
        uint256 interoperableUnity = 1e18;
        uint256 interoperableHalfUnity = (interoperableUnity / 51) * 100;
        uint256 mainInterfaceUnity = 10 ** decimals(itemId);
        if(interoperableTotalSupply <= interoperableUnity && amount <= interoperableUnity) {
            return amount < interoperableHalfUnity ? 0 : mainInterfaceUnity;
        }
        return (amount * mainInterfaceUnity) / interoperableUnity;
    }

    function toInteroperableInterfaceAmount(uint256 amount, uint256 itemId, address account) override public view returns(uint256) {
        if(amount == 0) {
            return 0;
        }
        if(decimals(itemId) == 18) {
            return amount;
        }
        uint256 fullPrecisionAmount = amount * 10 ** (18 - decimals(itemId));
        if(account == address(0)) {
            return fullPrecisionAmount;
        }
        uint256 interoperableBalance = IItemMainInterface(mainInterface).balanceOf(account, itemId);
        if(interoperableBalance == 0) {
            return fullPrecisionAmount;
        }
        uint256 interoperableTotalSupply = IERC20(interoperableOf(itemId)).totalSupply();
        uint256 interoperableUnity = 1e18;
        uint256 interoperableHalfUnity = (interoperableUnity / 51) * 100;
        if(interoperableTotalSupply <= interoperableUnity && fullPrecisionAmount == interoperableUnity && interoperableBalance >= interoperableHalfUnity) {
            return interoperableBalance <= fullPrecisionAmount ? interoperableBalance : fullPrecisionAmount;
        }
        return fullPrecisionAmount;
    }

    function uri(uint256 itemId) override external view returns(string memory) {
        return IItemMainInterface(mainInterface).uri(itemId);
    }

    function itemPlainURI(uint256 itemId) override external view returns(string memory) {
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
        return IItemMainInterface(mainInterface).isApprovedForCollection(account, operator, collectionId);
    }

    function setApprovalForAll(address operator, bool approved) override external {
        return IItemMainInterface(mainInterface).setApprovalForCollection(collectionId, msg.sender, operator, approved);
    }

    function safeTransferFrom(address from, address to, uint256 itemId, uint256 amount, bytes calldata data) virtual override external {
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, from, to, itemId, toInteroperableInterfaceAmount(amount, itemId, from)));
        ERC1155CommonLibrary.doSafeTransferAcceptanceCheck(msg.sender, from, to, itemId, amount, data);
        emit TransferSingle(msg.sender, from, to, itemId, amount);
    }

    function safeBatchTransferFrom(address from, address to, uint256[] calldata itemIds, uint256[] calldata amounts, bytes calldata data) virtual override external {
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], from);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(msg.sender, from, to, itemIds, interoperableInterfaceAmounts));
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
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, toInteroperableInterfaceAmount(amount, itemId, account)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory) override virtual public {
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], account);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts));
        emit TransferBatch(msg.sender, account, address(0), itemIds, amounts);
    }
}