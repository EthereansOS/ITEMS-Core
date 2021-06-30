//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../IItemProjection.sol";

interface IERC721Wrapper is IItemProjection {

    event Token(address indexed tokenAddress, uint256 indexed tokenId, uint256 indexed itemId);

    function itemIdOf(address tokenAddress, uint256 tokenId) external view returns(uint256);

    function mint(address[] calldata tokenAddresses, uint256[] calldata tokenIds, address[] calldata receivers) external returns(uint256[] memory itemIds);
}