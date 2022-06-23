//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import { ERC1155DeckWrapper as Original } from "../../../../projection/ERC1155Deck/ERC1155DeckWrapper.sol";
import "@ethereansos/swissknife/contracts/environment/optimism/OptimismLib.sol";

contract ERC1155DeckWrapper is Original {

    constructor(bytes memory lazyInitData) Original(lazyInitData) {
    }

    function _blockNumber() internal override view returns(uint256) {
        return OptimismLib._blockNumber();
    }
}