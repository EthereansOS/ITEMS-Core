//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "../../model/Item.sol";

interface IDeckPresto is IERC721Receiver, IERC1155Receiver {

    function data() external view returns(address prestoAddress, address erc721DeckWrapper, address erc1155DeckWrapper);

    function buyAndUnwrap(PrestoOperation calldata operation, bool isERC721, bytes[] calldata payload) external payable returns(uint256 outputAmount);

    function wrapAndSell721(address tokenAddress, uint256[] calldata tokenIds, bool[] calldata reserve, PrestoOperation[] calldata operations) external returns(uint256[] memory outputAmounts);
}

struct PrestoOperation {

    address inputTokenAddress;
    uint256 inputTokenAmount;

    address ammPlugin;
    address[] liquidityPoolAddresses;
    address[] swapPath;
    bool enterInETH;
    bool exitInETH;

    uint256[] tokenMins;

    address[] receivers;
    uint256[] receiversPercentages;
}

interface IPrestoUniV3 {

    function execute(PrestoOperation[] memory operations) external payable returns(uint256[] memory outputAmounts);
}