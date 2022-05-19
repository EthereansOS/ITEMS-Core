//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

interface IItemInteroperableInterface is IERC20, IERC20Metadata, IERC20Permit {

    function init() external;
    function mainInterface() external view returns(address);
    function itemId() external view returns(uint256);
    function emitEvent(bool forApprove, bool isMulti, bytes calldata data) external;
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    function EIP712_PERMIT_DOMAINSEPARATOR_NAME_AND_VERSION() external view returns(string memory name, string memory version);
}