//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../../common/IEthItemModelBase.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title ERC721 NFT-Based EthItem, version 1.
 * @dev All the wrapped ERC721 NFTs will be created following this Model.
 * The minting operation can be done only by transfering the original ERC721 Item through the classic safeTransferFrom call.
 * The burning operation will send back the original wrapped NFT.
 * To initalize it, the original 'init(address,string,string)' 
 * function of the EthItem Token Standard will be used, but the first address parameter will be the original ERC721 Source Contract to Wrap, and NOT the ERC20Model, which is always taken by the Contract who creates the Wrapper.
 * As the entire amount of the contract is always 1, the owner of the object can be the 
 */
interface IERC721WrapperV1 is IEthItemModelBase, IERC721Receiver {

    /**
     * @return sourceAddress The address of the original wrapped ERC721 NFT
     */
    function source() external view returns(address sourceAddress);
}
