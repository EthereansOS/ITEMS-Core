//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "./IERC721Wrapper.sol";
import "../ItemProjection.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

contract ERC721Wrapper is IERC721Wrapper, ItemProjection, IERC721Receiver {

    mapping(bytes32 => uint256) private _itemIdOf;

    function itemIdOf(address tokenAddress, uint256 tokenId) override public view returns(uint256) {
        return _itemIdOf[_toItemKey(tokenAddress, tokenId)];
    }

    function decimals(uint256) override(IERC1155Views, ItemProjection) public pure returns(uint256) {
        return 0;
    }

    function mintItems(CreateItem[] calldata) virtual override(Item, ItemProjection) external returns(uint256[] memory) {
        revert("You need to send ERC721 token or call proper mint function");
    }

    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) override external returns (bytes4) {
        address receiver = from;
        if(data.length > 0) {
            receiver = abi.decode(data, (address));
        }
        receiver = receiver != address(0) ? receiver : from;
        uint256 itemId = itemIdOf(msg.sender, tokenId);
        uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(_buildCreateItems(msg.sender, tokenId, receiver, itemId))[0];
        if(itemId == 0) {
            emit Token(msg.sender, tokenId, _itemIdOf[_toItemKey(msg.sender, tokenId)] = createdItemId);
        }
        return this.onERC721Received.selector;
    }

    function mint(address[] calldata tokenAddresses, uint256[] calldata tokenIds, address[] calldata receivers) override external returns(uint256[] memory itemIds) {
        address defaultReceiver = msg.sender;
        if(receivers.length == 1) {
            defaultReceiver = receivers[0];
        }
        defaultReceiver = defaultReceiver != address(0) ? defaultReceiver : msg.sender;
        itemIds = new uint256[](tokenIds.length);
        for(uint256  i = 0 ; i < itemIds.length; i++) {
            IERC721(tokenAddresses[i]).transferFrom(msg.sender, address(this), tokenIds[i]);
            itemIds[i] = itemIdOf(tokenAddresses[i], tokenIds[i]);
            uint256 createdItemId = IItemMainInterface(mainInterface).mintItems(_buildCreateItems(tokenAddresses[i], tokenIds[i], receivers.length <= 1 ? defaultReceiver : receivers[i], itemIds[i]))[0];
            if(itemIds[i] == 0) {
                emit Token(tokenAddresses[i], tokenIds[i], itemIds[i] = _itemIdOf[_toItemKey(tokenAddresses[i], tokenIds[i])] = createdItemId);
            }
        }
    }

    function burn(address account, uint256 itemId, uint256 amount, bytes memory data) override(Item, ItemProjection) public {
        IItemMainInterface(mainInterface).mintTransferOrBurn(false, abi.encode(msg.sender, account, address(0), itemId, toInteroperableInterfaceAmount(amount, itemId, account)));
        emit TransferSingle(msg.sender, account, address(0), itemId, amount);
        _burn(account, itemId, data);
    }

    function burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data) override(Item, ItemProjection) public {
        uint256[] memory interoperableInterfaceAmounts = new uint256[](amounts.length);
        for(uint256 i = 0 ; i < interoperableInterfaceAmounts.length; i++) {
            interoperableInterfaceAmounts[i] = toInteroperableInterfaceAmount(amounts[i], itemIds[i], account);
        }
        IItemMainInterface(mainInterface).mintTransferOrBurn(true, abi.encode(msg.sender, account, address(0), itemIds, interoperableInterfaceAmounts));
        emit TransferBatch(msg.sender, account, address(0), itemIds, amounts);
        bytes[] memory datas = abi.decode(data, (bytes[]));
        for(uint256 i = 0; i < itemIds.length; i++) {
            _burn(account, itemIds[i], datas[i]);
        }
    }

    function _burn(address from, uint256 itemId, bytes memory data) private {
        (address tokenAddress, uint256 tokenId, address receiver, bytes memory payload, bool safe, bool withData) = abi.decode(data, (address, uint256, address, bytes, bool, bool));
        receiver = receiver != address(0) ? receiver : from;
        require(itemIdOf(tokenAddress, tokenId) == itemId, "Wrong ERC721");
        IERC721 token = IERC721(tokenAddress);
        if(!safe) {
            token.transferFrom(address(this), receiver, tokenId);
            return;
        }
        if(withData) {
            token.safeTransferFrom(address(this), receiver, tokenId, payload);
            return;
        }
        token.safeTransferFrom(address(this), receiver, tokenId);
    }

    function _buildCreateItems(address tokenAddress, uint256 tokenId, address from, uint256 itemId) private view returns(CreateItem[] memory createItems) {
        (string memory name, string memory symbol, string memory uri) = itemId != 0 ? ("", "", "") : _tryRecoveryMetadata(tokenAddress, tokenId);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1e18 - (itemId == 0 ? 0 : IItemMainInterface(mainInterface).totalSupply(itemId));
        address[] memory accounts = new address[](1);
        accounts[0] = from;
        createItems = new CreateItem[](1);
        createItems[0] = CreateItem(Header(address(0), name, symbol, uri), itemId, accounts, amounts);
    }

    function _tryRecoveryMetadata(address source, uint256 tokenId) private view returns(string memory name, string memory symbol, string memory uri) {
        IERC721Metadata nft = IERC721Metadata(source);
        try nft.name() returns(string memory n) {
            name = n;
        } catch {
        }
        try nft.symbol() returns(string memory s) {
            symbol = s;
        } catch {
        }
        try nft.tokenURI(tokenId) returns(string memory s) {
            uri = s;
        } catch {
        }
        if(keccak256(bytes(name)) == keccak256("")) {
            name = _toString(source);
        }
        if(keccak256(bytes(symbol)) == keccak256("")) {
            symbol = _toString(source);
        }
    }

    function _toString(address addr) private pure returns(string memory) {
        bytes memory data = abi.encodePacked(addr);
        bytes memory alphabet = "0123456789ABCDEF";

        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint i = 0; i < data.length; i++) {
            str[2+i*2] = alphabet[uint(uint8(data[i] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }

    function _toItemKey(address tokenAddress, uint256 tokenId) private pure returns(bytes32) {
        return keccak256(abi.encodePacked(tokenAddress, tokenId));
    }
}