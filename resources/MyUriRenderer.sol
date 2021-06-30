//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;

import "@ethereansos/swissknife/contracts/dynamicMetadata/model/IDynamicUriRenderer.sol";
import "../contracts/model/IItemMainInterface.sol";

import { AddressUtilities, Uint256Utilities, BytesUtilities, Bytes32Utilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

contract MyUriRenderer is IDynamicUriRenderer {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;
    using Bytes32Utilities for bytes32;
    using BytesUtilities for bytes;

    function render(address subject, string calldata plainUri, bytes calldata inputData, address caller, bytes calldata rendererData) external override view returns (string memory) {
        return string(abi.encodePacked(
            _1(subject, plainUri, inputData, caller, rendererData),
            _2(subject, plainUri, inputData, caller, rendererData),
            _renderRendererData(rendererData),
            _renderInputData(subject, caller, inputData)
        ));
    }

    function _1(address, string calldata, bytes calldata, address, bytes calldata) private view returns (string memory) {
        return string(abi.encodePacked(
            "Greetings from the Dynamic Uri Renderer Contract\n\n",
            address(this).toString(),
            ",\n\n directly called by the Dynamic Uri Resolver Contract\n\n",
            msg.sender.toString(),
            ".\n\n"
        ));
    }

    function _2(address subject, string calldata plainUri, bytes calldata, address caller, bytes calldata) private pure returns (string memory) {
        return string(abi.encodePacked(
            "This message has been automatically generated when your address\n\n",
            caller.toString(),
            '\n\ncalled the contract\n\n',
            subject.toString(),
            '\n\npassing the uri\n\n"',
            plainUri,
            '"\n\nand it is pretty fun to see what a so simple string can generate!\n'
        ));
    }

    function _renderInputData(address subject, address caller, bytes calldata inputData) private view returns(string memory) {
        if(inputData.length == 0) {
            return "\n";
        }
        (bytes32 collectionId, uint256 itemId) = abi.decode(inputData, (bytes32, uint256));
        if(collectionId == bytes32(0)) {
            uint256 balance = IItemMainInterface(subject).balanceOf(caller, itemId);
            balance /= (10**IItemMainInterface(subject).decimals(itemId));
            return string(abi.encodePacked(
                "You are watching the metadata of the item #:\n",
                itemId.toString(),
                "\nand the caller balance is:\n",
                balance.toString(),
                ".\n"
            ));
        }
        (address host, string memory name, string memory symbol,) = IItemMainInterface(subject).collection(collectionId);
        return string(abi.encodePacked(
            "You are watching the metadata of the collection with Id:\n\n",
            collectionId.toString(),
            ",\n\nHaving host:\n",
            host.toString(),
            ',\nname:\n',
            name,
            '\n and symbol:\n',
            symbol,
            '.\n'
        ));
    }

    function _renderRendererData(bytes calldata rendererData) private pure returns(string memory) {
        if(rendererData.length == 0) {
            return "\n";
        }
        return string(abi.encodePacked(
            'The optional fixed data you can attach to every Uri, in this case is a string containing the sentence:\n\n"',
            rendererData.asString(),
            '".\n\n'
        ));
    }
}