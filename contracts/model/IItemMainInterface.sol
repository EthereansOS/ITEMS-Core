//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "./Item.sol";
import "@ethereansos/swissknife/contracts/dynamicMetadata/model/IDynamicMetadataCapableElement.sol";

struct ItemData {
    bytes32 collectionId;
    Header header;
    bytes32 domainSeparator;
    uint256 totalSupply;
    mapping(address => uint256) balanceOf;
    mapping(address => mapping(address => uint256)) allowance;
    mapping(address => uint256) nonces;
}

interface IItemMainInterface is Item, IDynamicMetadataCapableElement {

    event Collection(address indexed from, address indexed to, bytes32 indexed collectionId);

    function interoperableInterfaceModel() external view returns(address);

    function collection(bytes32 collectionId) external view returns(address host, string memory name, string memory symbol, string memory uri);
    function collectionUri(bytes32 collectionId) external view returns(string memory);
    function createCollection(Header calldata _collection, CreateItem[] calldata items) external returns(bytes32 collectionId, uint256[] memory itemIds);
    function setCollectionsMetadata(bytes32[] calldata collectionIds, Header[] calldata values) external returns(Header[] memory oldValues);

    function item(uint256 itemId) external view returns(bytes32 collectionId, Header memory header, bytes32 domainSeparator, uint256 totalSupply);

    function mintTransferOrBurn(bool isMulti, bytes calldata data) external;

    function allowance(address account, address spender, uint256 itemId) external view returns(uint256);
    function approve(address account, address spender, uint256 amount, uint256 itemId) external;
    function TYPEHASH_PERMIT() external view returns (bytes32);
    function EIP712_PERMIT_DOMAINSEPARATOR_NAME_AND_VERSION() external view returns(string memory domainSeparatorName, string memory domainSeparatorVersion);
    function permit(uint256 itemId, address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function nonces(address owner, uint256 itemId) external view returns(uint256);
}