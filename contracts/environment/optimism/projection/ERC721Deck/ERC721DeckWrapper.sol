//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import { ERC721DeckWrapper as Original } from "../../../../projection/ERC721Deck/ERC721DeckWrapper.sol";
import "@ethereansos/swissknife/contracts/environment/optimism/OptimismLib.sol";

contract ERC721DeckWrapper is Original {

    constructor(bytes memory lazyInitData) Original(lazyInitData) {
    }

    function _blockNumber() internal override view returns(uint256) {
        return OptimismLib._blockNumber();
    }
}