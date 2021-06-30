//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;

import { Uint256Utilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

contract Uint256Require {
    using Uint256Utilities for uint256;

    function _require(bool sentence, bytes memory data) private pure {
        if(sentence) {
            return;
        }
        (string[] memory names, uint256[] memory values) = abi.decode(data, (string[], uint256[]));
        string memory reason = "";
        for(uint256 i = 0; i < names.length; i++) {
            reason = string(abi.encodePacked(reason, names[i], ": ", values[i].toString(), i == names.length - 1 ? "" : ", "));
        }
        revert(reason);
    }
}