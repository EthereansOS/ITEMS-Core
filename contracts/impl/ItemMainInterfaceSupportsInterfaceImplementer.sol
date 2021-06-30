//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;

import "../model/IItemMainInterface.sol";

contract ItemMainInterfaceSupportsInterfaceImplementer is IERC165 {

    function supportsInterface(bytes4 interfaceId) external override pure returns(bool) {
        return 
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == IItemMainInterface(address(0)).balanceOf.selector ||
            interfaceId == IItemMainInterface(address(0)).balanceOfBatch.selector ||
            interfaceId == IItemMainInterface(address(0)).setApprovalForAll.selector ||
            interfaceId == IItemMainInterface(address(0)).isApprovedForAll.selector ||
            interfaceId == IItemMainInterface(address(0)).safeTransferFrom.selector ||
            interfaceId == IItemMainInterface(address(0)).safeBatchTransferFrom.selector ||
            interfaceId == 0xd9b67a26 ||//OpenSea Standard
            interfaceId == type(IERC1155Views).interfaceId ||
            interfaceId == IItemMainInterface(address(0)).totalSupply.selector ||
            interfaceId == 0x00ad800c ||//name(uint256)
            interfaceId == 0x4e41a1fb ||//symbol(uint256)
            interfaceId == IItemMainInterface(address(0)).decimals.selector ||
            interfaceId == 0x0e89341c ||//uri(uint256)
            interfaceId == type(Item).interfaceId ||
            interfaceId == 0x06fdde03 ||//name()
            interfaceId == 0x95d89b41 ||//symbol()
            interfaceId == 0xf5298aca ||//burn(address,uint256,uint256)
            interfaceId == 0x6b20c454 ||//burnBatch(address,uint256[],uint256[])
            interfaceId == 0x8a94b05f ||//burn(address,uint256,uint256,bytes)
            interfaceId == 0x5473422e ||//burnBatch(address,uint256[],uint256[],bytes)
            interfaceId == IItemMainInterface(address(0)).mintItems.selector ||
            interfaceId == IItemMainInterface(address(0)).setItemsCollection.selector ||
            interfaceId == IItemMainInterface(address(0)).setItemsMetadata.selector ||
            interfaceId == IItemMainInterface(address(0)).interoperableOf.selector ||
            interfaceId == type(IItemMainInterface).interfaceId ||
            interfaceId == IItemMainInterface(address(0)).interoperableInterfaceModel.selector ||
            interfaceId == IItemMainInterface(address(0)).collection.selector ||
            interfaceId == IItemMainInterface(address(0)).collectionUri.selector ||
            interfaceId == IItemMainInterface(address(0)).createCollection.selector ||
            interfaceId == IItemMainInterface(address(0)).setCollectionsMetadata.selector ||
            interfaceId == IItemMainInterface(address(0)).item.selector ||
            interfaceId == IItemMainInterface(address(0)).mintTransferOrBurn.selector ||
            interfaceId == IItemMainInterface(address(0)).allowance.selector ||
            interfaceId == IItemMainInterface(address(0)).approve.selector ||
            interfaceId == IItemMainInterface(address(0)).TYPEHASH_PERMIT.selector ||
            interfaceId == IItemMainInterface(address(0)).EIP712_PERMIT_DOMAINSEPARATOR_NAME_AND_VERSION.selector ||
            interfaceId == IItemMainInterface(address(0)).permit.selector ||
            interfaceId == IItemMainInterface(address(0)).nonces.selector;
    }
}