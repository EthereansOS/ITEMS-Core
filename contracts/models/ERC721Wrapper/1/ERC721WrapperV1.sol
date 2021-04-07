//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IERC721WrapperV1.sol";
import "../../common/EthItemModelBase.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol";

contract ERC721WrapperV1 is IERC721WrapperV1, EthItemModelBase {

    address internal _source;
    bool internal _idAsName;

    function init(
        address source,
        string memory name,
        string memory symbol
    ) public virtual override(IEthItemMainInterface, EthItemModelBase) {
        require(source != address(0), "Source cannot be void");
        _source = source;
        super.init(name, symbol);
        _idAsName = keccak256(bytes(name)) == keccak256(bytes(_toString(_source)));
        _registerInterface(this.onERC721Received.selector);
    }

    function source() public override view returns (address) {
        return _source;
    }

    function uri(uint256 objectId)
        public
        virtual
        override
        view
        returns (string memory)
    {
        return IERC721Metadata(_source).tokenURI(objectId);
    }

    function onERC721Received(
        address,
        address owner,
        uint256 objectId,
        bytes memory
    ) public virtual override returns (bytes4) {
        require(msg.sender == _source, "Unauthorized action!");
        _mint(owner, objectId);
        return this.onERC721Received.selector;
    }

    function burn(
        uint256 objectId,
        uint256 amount
    ) public virtual override {
        _burn(objectId, amount);
        emit TransferSingle(msg.sender, msg.sender, address(0), objectId, amount);
    }

    function burnBatch(
        uint256[] memory objectIds,
        uint256[] memory amounts
    ) public virtual override {
        for (uint256 i = 0; i < objectIds.length; i++) {
            _burn(objectIds[i], amounts[i]);
        }
        emit TransferBatch(msg.sender, msg.sender, address(0), objectIds, amounts);
    }

    function _burn(
        uint256 objectId,
        uint256 amount
    ) internal virtual override returns(uint256, uint256) {
        super._burn(objectId, amount);
        IERC721(_source).safeTransferFrom(address(this), msg.sender, objectId, "");
    }

    function _mint(
        address from,
        uint256 objectIdInput
    ) internal virtual override returns (uint256 objectId, address wrapperAddress) {
        wrapperAddress = _dest[objectId = objectIdInput];
        if (wrapperAddress == address(0)) {
            (address interoperableInterfaceModelAddress,) = interoperableInterfaceModel();
            _isMine[_dest[objectId] = wrapperAddress = _clone(interoperableInterfaceModelAddress)] = true;
            string memory name = _idAsName ? _toString(objectId) : _name;
            IEthItemInteroperableInterface(wrapperAddress).init(objectId, name, _symbol, _decimals);
            emit NewItem(objectId, wrapperAddress);
        }
        uint256 toMint = (10**_decimals) - asInteroperable(objectId).totalSupply();
        asInteroperable(objectId).mint(from, toMint);
        uint256 mintFeeToDFO = _sendMintFeeToDFO(from, objectId, toMint);
        uint256 nftAmount = toMainInterfaceAmount(objectId, toMint - mintFeeToDFO);
        if(nftAmount > 0) {
            emit Mint(objectId, wrapperAddress, nftAmount);
            emit TransferSingle(address(this), address(0), from, objectId, nftAmount);
        }
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