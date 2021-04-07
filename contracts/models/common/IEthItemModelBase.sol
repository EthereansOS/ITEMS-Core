//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "eth-item-token-standard/IEthItemMainInterface.sol";

/**
 * @dev This interface contains the commonn data provided by all the EthItem models
 */
interface IEthItemModelBase is IEthItemMainInterface {

    /**
     * @dev Contract Initialization, the caller of this method should be a Contract containing the logic to provide the EthItemERC20WrapperModel to be used to create ERC20-based objectIds
     * @param name the chosen name for this NFT
     * @param symbol the chosen symbol (Ticker) for this NFT
     */
    function init(string calldata name, string calldata symbol) external;

    /**
     * @return modelVersionNumber The version number of the Model, it should be progressive
     */
    function modelVersion() external pure returns(uint256 modelVersionNumber);

    /**
     * @return factoryAddress the address of the Contract which initialized this EthItem
     */
    function factory() external view returns(address factoryAddress);
}