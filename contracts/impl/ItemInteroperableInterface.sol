//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;

import "../model/IItemMainInterface.sol";
import "../model/IItemInteroperableInterface.sol";

contract ItemInteroperableInterface is IItemInteroperableInterface {

    address public override mainInterface;

    function init() override external {
        require(mainInterface == address(0));
        mainInterface = msg.sender;
    }

    function DOMAIN_SEPARATOR() external override view returns (bytes32 domainSeparatorValue) {
        (,,domainSeparatorValue,) = IItemMainInterface(mainInterface).item(itemId());
    }

    function EIP712_PERMIT_DOMAINSEPARATOR_NAME_AND_VERSION() external override view returns(string memory, string memory) {
        return IItemMainInterface(mainInterface).EIP712_PERMIT_DOMAINSEPARATOR_NAME_AND_VERSION();
    }

    function itemId() override public view returns(uint256) {
        return uint160(address(this));
    }

    function emitEvent(bool forApprove, bool isMulti, bytes calldata data) override external {
        require(msg.sender == mainInterface, "Unauthorized");
        if(isMulti) {
            (address[] memory froms, address[] memory tos, uint256[] memory amounts) = abi.decode(data, (address[], address[], uint256[]));
            for(uint256 i = 0; i < froms.length; i++) {
                if(forApprove) {
                    emit Approval(froms[i], tos[i], amounts[i]);
                } else {
                    emit Transfer(froms[i], tos[i], amounts[i]);
                }
            }
            return;
        }
        (address from, address to, uint256 amount) = abi.decode(data, (address, address, uint256));
        if(forApprove) {
            emit Approval(from, to, amount);
        } else {
            emit Transfer(from, to, amount);
       }
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) override external {
        IItemMainInterface(mainInterface).permit(itemId(), owner, spender, value, deadline, v, r, s);
        emit Approval(owner, spender, value);
    }

    function burn(uint256 amount) override external {
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, msg.sender, address(0), itemId(), amount));
        emit Transfer(msg.sender, address(0), amount);
    }

    function name() override external view returns (string memory) {
        (, Header memory header,,) = IItemMainInterface(mainInterface).item(itemId());
        return header.name;
    }

    function symbol() override external view returns (string memory) {
        (, Header memory header,,) = IItemMainInterface(mainInterface).item(itemId());
        return header.symbol;
    }

    function decimals() override external pure returns (uint8) {
        return 18;
    }

    function nonces(address owner) external override view returns(uint256) {
        return IItemMainInterface(mainInterface).nonces(owner, itemId());
    }

    function totalSupply() override external view returns (uint256 totalSupplyValue) {
        (,,, totalSupplyValue) = IItemMainInterface(mainInterface).item(itemId());
    }

    function balanceOf(address account) override external view returns (uint256) {
        return IItemMainInterface(mainInterface).balanceOf(account, itemId());
    }

    function allowance(address owner, address spender) override external view returns (uint256) {
        return IItemMainInterface(mainInterface).allowance(owner, spender, itemId());
    }

    function approve(address spender, uint256 amount) override external returns(bool) {
        IItemMainInterface(mainInterface).approve(msg.sender, spender, amount, itemId());
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) override external returns(bool) {
        return _transferFrom(msg.sender, recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) override external returns(bool) {
        return _transferFrom(sender, recipient, amount);
    }

    function _transferFrom(address sender, address recipient, uint256 amount) private returns(bool) {
        require(sender != address(0), "transfer from the zero address");
        require(recipient != address(0), "transfer to the zero address");
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, sender, recipient, itemId(), amount));
        emit Transfer(sender, recipient, amount);
        return true;
    }
}