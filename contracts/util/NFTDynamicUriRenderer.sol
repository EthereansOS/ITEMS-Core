//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IItemMainInterface.sol";
import "../projection/ERC1155/IERC1155Wrapper.sol";
import "@ethereansos/swissknife/contracts/dynamicMetadata/model/IDynamicUriRenderer.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

contract NFTDynamicUriRenderer is IDynamicUriRenderer {

    address public host;
    string public uri;

    constructor(address _host, string memory _uri) {
        host = _host;
        uri = _uri;
    }

    function setHost(address newValue) external returns (address oldValue) {
        require(msg.sender == host, "unauthorized");
        oldValue = host;
        host = newValue;
    }

    function setUri(string calldata newValue) external returns (string memory oldValue) {
        require(msg.sender == host, "unauthorized");
        oldValue = uri;
        uri = newValue;
    }

    function render(address subject, string calldata, bytes calldata inputData, address, bytes calldata) external override view returns (string memory) {
        (bytes32 collectionId, uint256 itemId) = abi.decode(inputData, (bytes32, uint256));
        if(itemId == 0) {
            return uri;
        }
        (address collectionHost,,,) = IItemMainInterface(subject).collection(collectionId);
        IERC1155Wrapper wrapper = IERC1155Wrapper(collectionHost);
        (address tokenAddress, uint256 tokenId) = wrapper.source(itemId);
        try Item(tokenAddress).uri(tokenId) returns (string memory u) {
            return u;
        } catch {
            return IERC721Metadata(tokenAddress).tokenURI(tokenId);
        }
    }
}