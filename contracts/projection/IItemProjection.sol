//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../model/Item.sol";
import "@ethereansos/swissknife/contracts/generic/model/ILazyInitCapableElement.sol";

interface IItemProjection is Item, ILazyInitCapableElement {

    function mainInterface() external view returns(address);

    function collectionId() external view returns(bytes32);
    function uri() external view returns(string memory);
    function plainUri() external view returns(string memory);
    function itemPlainUri(uint256 itemId) external view returns(string memory);
    function setHeader(Header calldata value) external returns(Header memory oldValue);

    function toInteroperableInterfaceAmount(uint256 amount, uint256 itemId, address account) external view returns(uint256);
    function toMainInterfaceAmount(uint256 amount, uint256 itemId) external view returns(uint256);
}