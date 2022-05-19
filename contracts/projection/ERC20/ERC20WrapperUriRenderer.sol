//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../model/IItemMainInterface.sol";
import "../../model/IItemInteroperableInterface.sol";
import "./IERC20Wrapper.sol";
import "@ethereansos/swissknife/contracts/dynamicMetadata/model/IDynamicUriRenderer.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract ERC20WrapperUriRenderer is IDynamicUriRenderer {

    string internal constant TABLE_ENCODE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    bytes private constant ALPHABET = "0123456789abcdef";

    address public host;
    string public uri;

    constructor(address _host, string memory _uri) {
        host = _host;
        uri = _uri;
    }

    function setHost(address newValue) external returns (address oldValue) {
        require(msg.sender == host, "unauthorized");
        oldValue = host;
        host = newValue;
    }

    function setUri(string calldata newValue) external returns (string memory oldValue) {
        require(msg.sender == host, "unauthorized");
        oldValue = uri;
        uri = newValue;
    }

    function render(address subject, string calldata, bytes calldata inputData, address, bytes calldata) external override view returns (string memory) {
        (bytes32 collectionId, uint256 itemId) = abi.decode(inputData, (bytes32, uint256));
        if(itemId == 0) {
            return uri;
        }
        (address collectionHost,,,) = IItemMainInterface(subject).collection(collectionId);
        IERC20Wrapper wrapper = IERC20Wrapper(collectionHost);
        IERC20Metadata token = IERC20Metadata(wrapper.source(itemId));
        if(address(token) != address(0)) {
            try IItemInteroperableInterface(address(token)).mainInterface() returns (address mi) {
                return Item(mi).uri(IItemInteroperableInterface(address(token)).itemId());
            } catch {}
        }
        string memory externalURL = address(token) == address(0) ? "https://ethereum.org" : _getEtherscanTokenURL(address(token));
        return string(abi.encodePacked(
            'data:application/json;base64,',
            base64Encode(abi.encodePacked(
                '{"name":"',
                wrapper.name(itemId),
                '","symbol":"',
                wrapper.symbol(itemId),
                '","decimals":',
                toString(wrapper.decimals(itemId)),
                ',"external_url":"',
                externalURL,
                '","description":"',
                _getDescription(token, externalURL),
                '","image":"',
                _getTrustWalletImage(address(token)),
                '"}'
            ))
        ));
    }

    function _getEtherscanTokenURL(address tokenAddress) private view returns (string memory) {
        string memory prefix = "";
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        if(chainId == 3) {
            prefix = "ropsten.";
        }
        if(chainId == 4) {
            prefix = "rinkeby.";
        }
        if(chainId == 5) {
            prefix = "goerli.";
        }
        if(chainId == 42) {
            prefix = "kovan.";
        }
        return string(abi.encodePacked(
            'https://',
            prefix,
            'etherscan.io/token/',
            toString(tokenAddress)
        ));
    }

    function _getDescription(IERC20Metadata token, string memory externalURL) private view returns (string memory) {
        uint256 tokenDecimals = address(token) == address(0) ? 18 : token.decimals();
        return string(abi.encodePacked(
            'This Item wraps the original ERC20 Token ',
            address(token) == address(0) ? "Ethereum" : _stringValue(address(token), "name()", "NAME()"),
            ' (',
            address(token) == address(0) ? "ETH" : _stringValue(address(token), "symbol()", "SYMBOL()"),
            '), having decimals ',
            toString(tokenDecimals),
            '.\\n\\n',
            'For more info, visit ',
            externalURL,
            '.'
        ));
    }

    function _getTrustWalletImage(address tokenAddress) private pure returns (string memory) {
        if(tokenAddress == address(0)) {
            return string(
                abi.encodePacked(
                    'data:image/svg+xml;base64,',
                    base64Encode(bytes(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="2500" viewBox="0 0 32 32"><g fill="none" fill-rule="evenodd"><circle cx="16" cy="16" r="16" fill="#627EEA"/><g fill="#FFF" fill-rule="nonzero"><path fill-opacity=".602" d="M16.498 4v8.87l7.497 3.35z"/><path d="M16.498 4L9 16.22l7.498-3.35z"/><path fill-opacity=".602" d="M16.498 21.968v6.027L24 17.616z"/><path d="M16.498 27.995v-6.028L9 17.616z"/><path fill-opacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z"/><path fill-opacity=".602" d="M9 16.22l7.498 4.353v-7.701z"/></g></g></svg>'
                    ))
                )
            );
        }
        return string(abi.encodePacked(
            'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/',
            toString(tokenAddress),
            '/logo.png'
        ));
    }

    function _stringValue(address erc20TokenAddress, string memory firstTry, string memory secondTry) private view returns(string memory) {
        (bool success, bytes memory data) = erc20TokenAddress.staticcall{ gas: 20000 }(abi.encodeWithSignature(firstTry));
        if (!success) {
            (success, data) = erc20TokenAddress.staticcall{ gas: 20000 }(abi.encodeWithSignature(secondTry));
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

        return toString(erc20TokenAddress);
    }

    function base64Encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return '';

        string memory table = TABLE_ENCODE;

        uint256 encodedLen = 4 * ((data.length + 2) / 3);

        string memory result = new string(encodedLen + 32);

        assembly {
            mstore(result, encodedLen)

            let tablePtr := add(table, 1)

            let dataPtr := data
            let endPtr := add(dataPtr, mload(data))

            let resultPtr := add(result, 32)

            for {} lt(dataPtr, endPtr) {}
            {
                dataPtr := add(dataPtr, 3)
                let input := mload(dataPtr)

                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr( 6, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(        input,  0x3F))))
                resultPtr := add(resultPtr, 1)
            }

            switch mod(mload(data), 3)
            case 1 { mstore(sub(resultPtr, 2), shl(240, 0x3d3d)) }
            case 2 { mstore(sub(resultPtr, 1), shl(248, 0x3d)) }
        }

        return result;
    }

    function toString(uint256 _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    function toString(address _addr) internal pure returns (string memory) {
        return _addr == address(0) ? "0x0000000000000000000000000000000000000000" : toString(abi.encodePacked(_addr));
    }

    function toString(bytes memory data) internal pure returns(string memory) {
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2+i*2] = ALPHABET[uint256(uint8(data[i] >> 4))];
            str[3+i*2] = ALPHABET[uint256(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }
}