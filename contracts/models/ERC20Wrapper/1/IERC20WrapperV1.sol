//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../../common/IEthItemModelBase.sol";

/**
 * @title ERC20-Based EthItem, version 1.
 * @dev All the wrapped ERC20 Tokens will be created following this Model.
 * The minting operation can be done by calling the appropriate method given in this interface.
 * The burning operation will send back the original wrapped ERC20 amount.
 * To initalize it, the original 'init(address,string,string)'
 * function of the EthItem Token Standard will be used, but the first address parameter will be the original ERC20 Source Contract to Wrap, and NOT the ERC20Model, which is always taken by the Contract who creates the Wrapper.
 */
interface IERC20WrapperV1 is IEthItemModelBase {

    /**
     * @param objectId the Object Id you want to know info about
     * @return erc20TokenAddress the wrapped ERC20 Token address corresponding to the given objectId
     */
    function source(uint256 objectId) external view returns (address erc20TokenAddress);

     /**
     * @param erc20TokenAddress the wrapped ERC20 Token address you want to know info about
     * @return objectId the id in the collection which correspondes to the given erc20TokenAddress
     */
    function object(address erc20TokenAddress) external view returns (uint256 objectId);

    /**
     * @dev Mint operation.
     * It inhibits and bypasses the original EthItem Token Standard 'mint(uint256,string)'.
     * The logic will execute a transferFrom call to the given erc20TokenAddress to transfer the chosed amount of tokens
     * @param erc20TokenAddress The token address to wrap.
     * @param amount The token amount to wrap
     *
     * @return objectId the id given by this collection to the given erc20TokenAddress. It can be brand new if it is the first time this collection is created. Otherwhise, the firstly-created objectId value will be used.
     * @return wrapperAddress The address ethItemERC20Wrapper generated after the creation of the returned objectId
     */
    function mint(address erc20TokenAddress, uint256 amount) external returns (uint256 objectId, address wrapperAddress);

    function mintETH() external payable returns (uint256 objectId, address wrapperAddress);
}
