//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IERC1155WrapperV1.sol";
import "../../common/EthItemModelBase.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155MetadataURI.sol";

contract ERC1155WrapperV1 is IERC1155WrapperV1, EthItemModelBase {

    address internal _source;

    bool internal _supportsSpecificName;
    bool internal _supportsSpecificSymbol;
    bool internal _supportsSpecificDecimals;
    bool internal _idAsName;
    mapping(uint256 => uint256) internal _decimalsMap;

    function init(
        address source,
        string memory name,
        string memory symbol,
        bool supportsSpecificName,
        bool supportsSpecificSymbol,
        bool supportsSpecificDecimals
    ) public override {
        require(source != address(0), "Source cannot be void");
        _source = source;
        _supportsSpecificName = supportsSpecificName;
        _supportsSpecificSymbol = supportsSpecificSymbol;
        _supportsSpecificDecimals = supportsSpecificDecimals;
        _idAsName = keccak256(bytes(name)) == keccak256(bytes(_toString(_source)));
        return super.init(name, symbol);
    }

    function source() public view virtual override returns (address) {
        return _source;
    }

    function decimals(uint256 objectId)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return
            !_supportsSpecificDecimals
                ? 1
                : asInteroperable(objectId).decimals();
    }

    function uri(uint256 objectId)
        public
        virtual
        override
        view
        returns (string memory)
    {
        return IERC1155MetadataURI(_source).uri(objectId);
    }

    /**
     * @dev classic ERC-1155 onERC1155Received hook.
     * This method can be called only by the wrapped classic ERC1155 NFT, if it exists.
     * Call this method means that someone transfer original NFTs to receive wrapped ones.
     * So this method will provide brand new NFTs
     */
    function onERC1155Received(
        address,
        address owner,
        uint256 objectId,
        uint256 amount,
        bytes memory
    ) public virtual override returns (bytes4) {
        require(msg.sender == _source, "Unauthorized action!");
        _mint(owner, objectId, amount);
        return this.onERC1155Received.selector;
    }

    /**
     * @dev classic ERC-1155 onERC1155BatchReceived hook.
     * Same as onERC1155Received, but for multiple tokens at the same time
     */
    function onERC1155BatchReceived(
        address,
        address owner,
        uint256[] memory objectIds,
        uint256[] memory amounts,
        bytes memory
    ) public virtual override returns (bytes4) {
        require(msg.sender == _source, "Unauthorized action!");
        for (uint256 i = 0; i < objectIds.length; i++) {
            _mint(owner, objectIds[i], amounts[i]);
        }
        return this.onERC1155BatchReceived.selector;
    }

    function burn(
        uint256 objectId,
        uint256 amount
    ) public virtual override {
        _burn(objectId, amount);
        IERC1155(_source).safeTransferFrom(address(this), msg.sender, objectId, amount / (_supportsSpecificDecimals ? _itemDecimals(objectId) : 1), "");
        emit TransferSingle(msg.sender, msg.sender, address(0), objectId, amount);
    }

    function burnBatch(
        uint256[] memory objectIds,
        uint256[] memory amounts
    ) public virtual override {
        uint256[] memory normalAmounts = new uint256[](amounts.length);
        for (uint256 i = 0; i < objectIds.length; i++) {
            _burn(objectIds[i], amounts[i]);
            normalAmounts[i] = amounts[i] /  (_supportsSpecificDecimals ? _itemDecimals(objectIds[i]) : 1);
        }
        IERC1155(_source).safeBatchTransferFrom(address(this), msg.sender, objectIds, normalAmounts, "");
        emit TransferBatch(msg.sender, msg.sender, address(0), objectIds, amounts);
    }

    function toInteroperableInterfaceAmount(uint256 objectId, uint256 mainInterfaceAmount) public override virtual view returns (uint256 interoperableInterfaceAmount) {
        interoperableInterfaceAmount = _supportsSpecificDecimals ? mainInterfaceAmount : super.toInteroperableInterfaceAmount(objectId, mainInterfaceAmount);
    }

    function toMainInterfaceAmount(uint256 objectId, uint256 interoperableInterfaceAmount) public override(IEthItemMainInterface, EthItemModelBase) virtual view returns (uint256 mainInterfaceAmount) {
        mainInterfaceAmount = _supportsSpecificDecimals ? interoperableInterfaceAmount : super.toMainInterfaceAmount(objectId, interoperableInterfaceAmount);
    }

    function _mint(
        address from,
        uint256 objectIdInput,
        uint256 amount
    ) internal virtual returns (uint256 objectId, address wrapperAddress) {
        wrapperAddress = _dest[objectId = objectIdInput];
        if (wrapperAddress == address(0)) {
            (address interoperableInterfaceModelAddress,) = interoperableInterfaceModel();
            _isMine[_dest[objectId] = wrapperAddress = _clone(interoperableInterfaceModelAddress)] = true;
            (string memory name, string memory symbol, uint256 dec) = _getMintData(objectId);
            name = _idAsName ? _toString(objectId) : name;
            _decimalsMap[objectId] = dec;
            IEthItemInteroperableInterface(wrapperAddress).init(objectId, name, symbol, _decimals);
            emit NewItem(objectId, wrapperAddress);
        }
        uint256 itemDecimalsUnity = 10**_decimals;

        uint256 itemAmountDecimals = amount * (_supportsSpecificDecimals ? _itemDecimals(objectId) : itemDecimalsUnity);

        uint256 totalSupply = asInteroperable(objectId).totalSupply();
        uint256 toMint = itemDecimalsUnity > totalSupply ? itemDecimalsUnity - totalSupply : itemDecimalsUnity;
        if(itemAmountDecimals > itemDecimalsUnity) {
            uint256 first = itemDecimalsUnity > totalSupply ? itemDecimalsUnity - totalSupply : 0;
            uint256 entireAmount = first > 0 ? itemAmountDecimals - itemDecimalsUnity : itemAmountDecimals;
            toMint = first + entireAmount;
        }
        asInteroperable(objectId).mint(from, toMint);
        uint256 mintFeeToDFO = _sendMintFeeToDFO(from, objectId, toMint);
        uint256 nftAmount = toMainInterfaceAmount(objectId, toMint - mintFeeToDFO);
        if(nftAmount > 0) {
            emit Mint(objectId, wrapperAddress, nftAmount);
            emit TransferSingle(address(this), address(0), from, objectId, nftAmount);
        }
    }

    function _itemDecimals(uint256 objectId) internal view returns(uint256) {
        return (10**(_decimals - _decimalsMap[objectId]));
    }

    function _getMintData(uint256 objectId)
        internal
        virtual
        view
        returns (
            string memory name,
            string memory symbol,
            uint256 dec
        )
    {
        name = _supportsSpecificName ? IERC1155Views(_source).name(objectId) : _name;
        symbol = _supportsSpecificSymbol ? IERC1155Views(_source).symbol(objectId) : _symbol;
        dec = _supportsSpecificDecimals ? IERC1155Views(_source).decimals(objectId) : _decimals;
    }

    function _toString(address _addr) internal pure returns(string memory) {
        bytes32 value = bytes32(uint256(_addr));
        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint(uint8(value[i + 12] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(value[i + 12] & 0x0f))];
        }
        return string(str);
    }

    function _toString(uint _i) internal pure returns(string memory) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }
}