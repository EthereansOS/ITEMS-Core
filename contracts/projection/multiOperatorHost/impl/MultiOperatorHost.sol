//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../model/IMultiOperatorHost.sol";
import "../../ItemProjection.sol";

contract MultiOperatorHost is IMultiOperatorHost, ItemProjection {
    using BytesUtilities for bytes;

    mapping(uint256 => address) public override operator;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function _projectionLazyInit(bytes memory lazyInitData) internal override returns(bytes memory) {
        require(host == address(0), "No host allowed");
        (uint256[] memory ops, address[] memory authorized) = abi.decode(lazyInitData, (uint256[], address[]));
        for(uint256 i = 0; i < ops.length; i++) {
            _setOperator(ops[i], authorized[i]);
        }
        return "";
    }

    function setOperator(uint256 op, address newValue) external override returns(address oldValue) {
        require(operator[op] == msg.sender, "Unauthorized");
        return _setOperator(op, newValue);
    }

    function setApprovalForAll(address, bool) authorizedOnly override(ItemProjection, IERC1155) external {
        revert();
    }

    function setHeader(Header memory value) authorizedOnly override(IItemProjection, ItemProjection) external returns(Header memory oldValue) {
        value.host = address(this);
        Header[] memory values = new Header[](1);
        values[0] = value;
        bytes32[] memory collectionIds = new bytes32[](1);
        collectionIds[0] = collectionId;
        oldValue = IItemMainInterface(mainInterface).setCollectionsMetadata(collectionIds, values)[0];
        (address currentHost,,,) =  IItemMainInterface(mainInterface).collection(collectionId);
        require(currentHost == address(this), "Invalid change");
        return oldValue;
    }

    function safeTransferFrom(address from, address to, uint256 itemId, uint256 amount, bytes calldata data) authorizedOnly override(ItemProjection, IERC1155) external {
        require(from != address(0), "required from");
        require(to != address(0), "required to");
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(from, from, to, itemId, toInteroperableInterfaceAmount(amount, itemId, from)));
        ERC1155CommonLibrary.doSafeTransferAcceptanceCheck(msg.sender, from, to, itemId, amount, data);
        emit TransferSingle(msg.sender, from, to, itemId, amount);
    }

    function safeBatchTransferFrom(address from, address to, uint256[] calldata itemIds, uint256[] calldata amounts, bytes calldata data) authorizedOnly override(ItemProjection, IERC1155) external {
        require(from != address(0), "required from");
        require(to != address(0), "required to");
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], from);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(true, abi.encode(abi.encode(from, from, to, itemIds, interoperableInterfaceAmounts).asSingletonArray())));
        ERC1155CommonLibrary.doSafeBatchTransferAcceptanceCheck(msg.sender, from, to, itemIds, amounts, data);
        emit TransferBatch(msg.sender, from, to, itemIds, amounts);
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory) authorizedOnly override(ItemProjection, Item) public {
        require(account != address(0), "required account");
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(account, account, address(0), itemId, toInteroperableInterfaceAmount(amount, itemId, account)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory) authorizedOnly override(ItemProjection, Item) public {
        require(account != address(0), "required account");
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], account);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(true, abi.encode(abi.encode(account, account, address(0), itemIds, interoperableInterfaceAmounts).asSingletonArray())));
        emit TransferBatch(msg.sender, account, address(0), itemIds, amounts);
    }

    function _setOperator(uint256 op, address newValue) private returns(address oldValue) {
        require(op > 0, "invalid op");
        oldValue = operator[op];
        operator[op] = newValue;
        emit Operator(op, oldValue, newValue);
    }

    function _subjectIsAuthorizedFor(address subject, address location, bytes4 selector, bytes calldata, uint256) internal virtual override view returns(bool, bool) {
        //1 = mintItems, 2 = burn, 3 = transfer, 4 = setMetadata, 5 = itemsCollection
        uint256 op = selector == this.mintItems.selector ? 1 :
            /*(
                selector == 0xf5298aca ||//burn(address,uint256,uint256)
                selector == 0x6b20c454 ||//burnBatch(address,uint256[],uint256[])
                selector == 0x8a94b05f ||//burn(address,uint256,uint256,bytes)
                selector == 0x5473422e   //burnBatch(address,uint256[],uint256[],bytes)
            ) ? 2 :
            (selector == this.safeTransferFrom.selector || selector == this.safeBatchTransferFrom.selector) ? 3 :*/
            (selector == this.setHeader.selector || selector == this.setItemsMetadata.selector) ? 4 : 0;
            //selector == this.setItemsCollection.selector ? 5 : 0;
        return(true, op > 0 && location == address(this) && operator[op] == subject);
    }
}