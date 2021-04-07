//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../../common/IEthItemModelBase.sol";

/**
 * @dev EthItem token standard - Version 1
 * This is a pure extension of the EthItem Token Standard, which also introduces an optional extension that can introduce some external behavior to the EthItem.
 * Extension can also be a simple wallet
 */
interface INativeV1 is IEthItemModelBase {

    /**
     * @dev Contract initialization
     * @param name the chosen name for this NFT
     * @param symbol the chosen symbol (Ticker) for this NFT
     * @param extensionAddress the optional address of the extension. It can be a Wallet or a SmartContract
     * @param extensionInitPayload the optional payload useful to call the extension within the new created EthItem
     */
    function init(string calldata name, string calldata symbol, bool hasDecimals, string calldata collectionUri, address extensionAddress, bytes calldata extensionInitPayload) external returns(bytes memory extensionInitCallResponse);

    /**
     * @return extensionAddress the address of the eventual EthItem main owner or the SmartContract which contains all the logics to directly exploit all the Collection Items of this EthItem. It can also be a simple wallet
     */
    function extension() external view returns (address extensionAddress);

    /**
     * @param operator The address to know info about
     * @return result true if the given address is able to mint new tokens, false otherwise.
     */
    function canMint(address operator) external view returns (bool result);

    /**
     * @param objectId The item to know info about
     * @return result true if it is possible to mint more items of the given objectId, false otherwhise.
     */
    function isEditable(uint256 objectId) external view returns (bool result);

    /**
     * @dev Method callable by the extension only and useful to release the control on the EthItem, which from now on will run independently
     */
    function releaseExtension() external;

    function uri() external view returns (string memory);

    function decimals() external view returns (uint256);

    function mint(uint256 amount, string calldata tokenName, string calldata tokenSymbol, string calldata objectUri, bool editable) external returns (uint256 objectId, address tokenAddress);

    function mint(uint256 amount, string calldata tokenName, string calldata tokenSymbol, string calldata objectUri) external returns (uint256 objectId, address tokenAddress);

    function mint(uint256 objectId, uint256 amount) external;

    function makeReadOnly(uint256 objectId) external;

    function setUri(string calldata newUri) external;

    function setUri(uint256 objectId, string calldata newUri) external;
}