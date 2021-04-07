/* Discussion:
 * //github.com/b-u-i-d-l/ETHITEM
 */
/* Description:
 * ETHItem - New Orchestrator and new ERC20Wrapper
 * 
 * ETHItem Orchestrator and Factory now support multi-model creation. You can choose the model you want to create/wrap your items.
 * 
 * New ERC20Wrapper can now support more non-standard ERC20 Tokens thanks to the improvements to the Name and Symbol calls.
 */
// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

contract ProposalCode {

    string internal constant ETHITEM_ORCHESTRATOR_AUTHORIZED_KEY_PREFIX = "ehtitem.orchestrator.authorized";

    bytes private constant INIT_PAYLOAD = abi.encodeWithSignature("init(string,string)", "WrappedERC20", "IERC20");
    address private constant NEW_ORCHESTRATOR = {0};
    address private constant OLD_ORCHESTRATOR = {1};

    string private _metadataLink;

    constructor(string memory metadataLink) public {
        _metadataLink = metadataLink;
    }

    function getMetadataLink() public view returns(string memory) {
        return _metadataLink;
    }

    function onStart(address, address) public {
    }

    function onStop(address) public {
    }

    function callOneTime(address) public {
        IStateHolder stateHolder = IStateHolder(IMVDProxy(msg.sender).getStateHolderAddress());
        if(OLD_ORCHESTRATOR != address(0)) {
            stateHolder.clear(_toStateHolderKey(ETHITEM_ORCHESTRATOR_AUTHORIZED_KEY_PREFIX, _toString(OLD_ORCHESTRATOR)));
        }
        stateHolder.setBool(_toStateHolderKey(ETHITEM_ORCHESTRATOR_AUTHORIZED_KEY_PREFIX, _toString(NEW_ORCHESTRATOR)), true);
        IEthItemOrchestrator(NEW_ORCHESTRATOR).createERC20Wrapper(INIT_PAYLOAD);
    }

    function _toStateHolderKey(string memory a, string memory b) internal pure returns(string memory) {
        return _toLowerCase(string(abi.encodePacked(a, ".", b)));
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

    function _toLowerCase(string memory str) internal pure returns(string memory) {
        bytes memory bStr = bytes(str);
        for (uint i = 0; i < bStr.length; i++) {
            bStr[i] = bStr[i] >= 0x41 && bStr[i] <= 0x5A ? bytes1(uint8(bStr[i]) + 0x20) : bStr[i];
        }
        return string(bStr);
    }
}

interface IEthItemOrchestrator {
    function createERC20Wrapper(bytes calldata modelInitPayload)
        external
        returns (address newEthItemAddress, bytes memory modelInitCallResponse);
}

interface IMVDProxy {
    function getStateHolderAddress() external view returns(address);
}

interface IStateHolder {
    function setBool(string calldata varName, bool val) external returns(bool);
    function clear(string calldata varName) external returns(string memory oldDataType, bytes memory oldVal);
}