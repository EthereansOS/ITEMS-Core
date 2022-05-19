//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../IItemProjection.sol";

interface IERC1155DeckWrapper is IItemProjection {

    function reserveTimeInBlocks() external view returns(uint256);

    function reserveData(bytes32 reserveDataKey) external view returns(address unwrapper, uint256 timeout, uint256 amount);

    event ReserveData(address from, address indexed tokenAddress, uint256 indexed tokenId, uint256 amount, uint256 timeout, bytes32 indexed reserveDataKey);

    event ReserveDataUnlocked(address indexed from, bytes32 indexed reserveDataKey, address tokenAddress, uint256 tokenId, address unwrapper, uint256 amount, uint256 timeout);

    function unlockReserves(address[] calldata owners, address[] calldata tokenAddresses, uint256[] calldata tokenIds, uint256[] calldata amounts) external;

    function mintItems(CreateItem[] calldata createItemsInput, bool[] calldata reserveArray) external returns(uint256[] memory itemIds);

    event Token(address indexed tokenAddress, uint256 indexed tokenId, uint256 indexed itemId);

    function itemIdOf(address tokenAddress, uint256 tokenId) external view returns(uint256);

    function source(uint256 itemId) external view returns(address tokenAddress, bytes32 tokenKey);
}