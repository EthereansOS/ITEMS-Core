//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IERC20WrapperV1.sol";
import "../../common/EthItemModelBase.sol";
import "eth-item-token-standard/IERC20Data.sol";

contract ERC20WrapperV1 is IERC20WrapperV1, EthItemModelBase {

    uint256 public constant ETHEREUM_OBJECT_ID = uint256(keccak256(bytes("THE ETHEREUM OBJECT IT")));

    mapping(uint256 => address) internal _sources;
    mapping(uint256 => uint256) internal _decimalsMap;
    mapping(address => uint256) internal _objects;

    function init(
        string memory name,
        string memory symbol
    ) public virtual override(IEthItemModelBase, EthItemModelBase) {
        super.init(name, symbol);
        (address interoperableInterfaceModelAddress,) = interoperableInterfaceModel();
        _isMine[_dest[ETHEREUM_OBJECT_ID] = _clone(interoperableInterfaceModelAddress)] = true;
        IEthItemInteroperableInterface(_dest[ETHEREUM_OBJECT_ID]).init(ETHEREUM_OBJECT_ID, "EthereumItem", "IETH", _decimalsMap[ETHEREUM_OBJECT_ID] = _decimals);
        emit NewItem(ETHEREUM_OBJECT_ID, _dest[ETHEREUM_OBJECT_ID]);
        emit Mint(ETHEREUM_OBJECT_ID, _dest[ETHEREUM_OBJECT_ID], 0);
    }

    function source(uint256 objectId) public override virtual view returns (address erc20TokenAddress) {
        erc20TokenAddress = _sources[objectId];
    }

    function object(address erc20TokenAddress) public override virtual view returns (uint256 objectId) {
        objectId = _objects[erc20TokenAddress];
    }

    function mintETH() public virtual payable override returns (uint256 objectId, address wrapperAddress) {
        require(msg.value > 0, "Insufficient amount");
        _mintItems(objectId = ETHEREUM_OBJECT_ID, wrapperAddress = _dest[ETHEREUM_OBJECT_ID], msg.value);
    }

    function mint(address erc20TokenAddress, uint256 amount)
        public
        virtual
        override
        returns (uint256 objectId, address wrapperAddress)
    {
        wrapperAddress = _dest[objectId = _objects[erc20TokenAddress]];
        if (wrapperAddress == address(0)) {
            (address interoperableInterfaceModelAddress,) = interoperableInterfaceModel();
            objectId = uint256(wrapperAddress = _clone(interoperableInterfaceModelAddress));
            _isMine[_dest[objectId] = wrapperAddress] = true;
            _sources[objectId] = erc20TokenAddress;
            _objects[erc20TokenAddress] = objectId;
            (string memory name, string memory symbol, uint256 dec) = _getMintData(erc20TokenAddress);
            _decimalsMap[objectId] = dec;
            IEthItemInteroperableInterface(wrapperAddress).init(objectId, name, symbol, _decimals);
            emit NewItem(objectId, wrapperAddress);
        }
        uint256 balanceBefore = IERC20Data(erc20TokenAddress).balanceOf(address(this));
        _safeTransferFrom(IERC20Data(erc20TokenAddress), msg.sender, address(this), amount);
        _mintItems(objectId, wrapperAddress, IERC20Data(erc20TokenAddress).balanceOf(address(this)) - balanceBefore);
    }

    function _mintItems(uint256 objectId, address wrapperAddress, uint256 amount) internal virtual {
        uint256 itemAmountDecimals = amount * _itemDecimals(objectId);
        asInteroperable(objectId).mint(msg.sender, itemAmountDecimals);
        uint256 itemAmount = itemAmountDecimals - _sendMintFeeToDFO(msg.sender, objectId, itemAmountDecimals);
        if(itemAmount > 0) {
            emit Mint(objectId, wrapperAddress, itemAmount);
            emit TransferSingle(address(this), address(0), msg.sender, objectId, itemAmount);
        }
    }

    function burn(
        uint256 objectId,
        uint256 amount
    ) public virtual override(IEthItemMainInterface) {
        _burn(objectId, amount);
        emit TransferSingle(msg.sender, msg.sender, address(0), objectId, amount);
    }

    function burnBatch(
        uint256[] memory objectIds,
        uint256[] memory amounts
    ) public virtual override(IEthItemMainInterface) {
        for (uint256 i = 0; i < objectIds.length; i++) {
            _burn(objectIds[i], amounts[i]);
        }
        emit TransferBatch(msg.sender, msg.sender, address(0), objectIds, amounts);
    }

    function _burn(
        uint256 objectId,
        uint256 amount
    ) internal virtual override returns(uint256 burnt, uint256) {
        (burnt,) = super._burn(objectId, amount);
        uint256 value = burnt / _itemDecimals(objectId);
        if(objectId == ETHEREUM_OBJECT_ID) {
            msg.sender.transfer(value);
        } else {
            _safeTransfer(IERC20Data(source(objectId)), msg.sender, value);
        }
    }

    function _getMintData(address erc20TokenAddress)
        internal
        virtual
        view
        returns (
            string memory name,
            string memory symbol,
            uint256 dec
        )
    {
        IERC20Data erc20Token = IERC20Data(erc20TokenAddress);
        name = string(abi.encodePacked(_stringValue(erc20Token, "name()", "NAME()"), " item"));
        symbol = string(abi.encodePacked("i", _stringValue(erc20Token, "symbol()", "SYMBOL()")));
        dec = _safeDecimals(erc20Token);
        if(dec == 0) {
            dec = _decimals;
        }
    }

    function _itemDecimals(uint256 objectId) internal view returns(uint256) {
        return (10**(_decimals - _decimalsMap[objectId]));
    }

    function _safeTransfer(IERC20Data erc20Token, address to, uint256 value) internal {
        bytes memory returnData = _call(address(erc20Token), abi.encodeWithSelector(erc20Token.transfer.selector, to, value));
        require(returnData.length == 0 || abi.decode(returnData, (bool)), 'TRANSFER_FAILED');
    }

    function _safeTransferFrom(IERC20Data erc20Token, address from, address to, uint256 value) private {
        bytes memory returnData = _call(address(erc20Token), abi.encodeWithSelector(erc20Token.transferFrom.selector, from, to, value));
        require(returnData.length == 0 || abi.decode(returnData, (bool)), 'TRANSFERFROM_FAILED');
    }

    function _call(address location, bytes memory payload) private returns(bytes memory returnData) {
        assembly {
            let result := call(gas(), location, 0, add(payload, 0x20), mload(payload), 0, 0)
            let size := returndatasize()
            returnData := mload(0x40)
            mstore(returnData, size)
            let returnDataPayloadStart := add(returnData, 0x20)
            returndatacopy(returnDataPayloadStart, 0, size)
            mstore(0x40, add(returnDataPayloadStart, size))
            switch result case 0 {revert(returnDataPayloadStart, size)}
        }
    }

    function _safeDecimals(IERC20Data erc20Token) internal view returns(uint256 dec) {
        (, bytes memory data) = address(erc20Token).staticcall(abi.encodeWithSelector(erc20Token.decimals.selector));
        dec = data.length == 0 ? 0 : abi.decode(data, (uint256));
    }

    function _stringValue(IERC20Data erc20Token, string memory firstTry, string memory secondTry) internal view returns(string memory) {
        (bool success, bytes memory data) = address(erc20Token).staticcall{ gas: 20000 }(abi.encodeWithSignature(firstTry));
        if (!success) {
            (success, data) = address(erc20Token).staticcall{ gas: 20000 }(abi.encodeWithSignature(secondTry));
        }

        if (success && data.length >= 96) {
            (uint256 offset, uint256 len) = abi.decode(data, (uint256, uint256));
            if (offset == 0x20 && len > 0 && len <= 256) {
                return string(abi.decode(data, (bytes)));
            }
        }

        if (success && data.length == 32) {
            uint len = 0;
            while (len < data.length && data[len] >= 0x20 && data[len] <= 0x7E) {
                len++;
            }

            if (len > 0) {
                bytes memory result = new bytes(len);
                for (uint i = 0; i < len; i++) {
                    result[i] = data[i];
                }
                return string(result);
            }
        }

        return _toHex(abi.encodePacked(address(erc20Token)));
    }

    function _toHex(bytes memory data) private pure returns(string memory) {
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        uint j = 2;
        for (uint i = 0; i < data.length; i++) {
            uint a = uint8(data[i]) >> 4;
            uint b = uint8(data[i]) & 0x0f;
            str[j++] = byte(uint8(a + 48 + (a/10)*39));
            str[j++] = byte(uint8(b + 48 + (b/10)*39));
        }

        return string(str);
    }

    function decimals(uint256 objectId)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return asInteroperable(objectId).decimals();
    }

    function toInteroperableInterfaceAmount(uint256, uint256 mainInterfaceAmount) public override virtual view returns (uint256 interoperableInterfaceAmount) {
        interoperableInterfaceAmount = mainInterfaceAmount;
    }

    function toMainInterfaceAmount(uint256, uint256 interoperableInterfaceAmount) public override(IEthItemMainInterface, EthItemModelBase) virtual view returns (uint256 mainInterfaceAmount) {
        mainInterfaceAmount = interoperableInterfaceAmount;
    }
}