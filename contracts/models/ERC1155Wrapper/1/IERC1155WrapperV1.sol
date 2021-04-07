//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../../common/IEthItemModelBase.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/**
 * @title ERC1155 NFT-Based EthItem, version 1.
 * @dev All the wrapped ERC1155 NFTs will be created following this Model.
 * The minting operation can be done only by transfering the original ERC1155 Item through the classic 'safeTransferFrom/safeBatchTransferFrom' calls.
 * The burning operation will send back the original wrapped NFT.
 */
interface IERC1155WrapperV1 is IEthItemModelBase, IERC1155Receiver {

    /**
     * @dev Contract initialization
     * @param name the chosen name for this NFT
     * @param symbol the chosen symbol (Ticker) for this NFT
     * @param source - The address of the Original ERC1155 NFT Wrapped in this collection
     * @param supportsSpecificName - Set to true if the given source NFT supports the 'name(uint256)' function.
     * @param supportsSpecificSymbol - Set to true if the given source NFT supports the 'symbol(uint256)' function.
     * @param supportsSpecificDecimals - Set to true if the given source NFT supports the 'decimals(uint256)' function.
     */
    function init(
        address source,
        string calldata name,
        string calldata symbol,
        bool supportsSpecificName,
        bool supportsSpecificSymbol,
        bool supportsSpecificDecimals
    ) external;

    /**
     * @return sourceAddress The address of the original wrapped ERC1155 NFT
     */
    function source() external view returns(address sourceAddress);
}