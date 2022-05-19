//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../IItemProjection.sol";

interface IERC721DeckWrapper is IItemProjection {

    function reserveTimeInBlocks() external view returns(uint256);

    function reserveData(address tokenAddress, uint256 tokenId) external view returns(address unwrapper, uint256 timeout);

    function unlockReserves(address[] calldata tokenAddresses, uint256[] calldata tokenIds) external;

    function mintItems(CreateItem[] calldata createItemsInput, bool[] calldata reserveArray) external returns(uint256[] memory itemIds);

    event Token(address indexed tokenAddress, uint256 indexed tokenId, uint256 indexed itemId);

    function itemIdOf(address tokenAddress) external view returns(uint256);

    function source(uint256 itemId) external view returns(address tokenAddress);
}