//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../IItemProjection.sol";

contract ItemProjectionFactory {

    address public mainInterface;
    address public host;
    address public model;

    event ItemProjectionCreated(address indexed startingModel, address indexed createdModel, address indexed creator, bytes initResponse);

    constructor(address mainInterfaceAddress, address hostAddress, address modelAddress) {
        mainInterface = mainInterfaceAddress;
        host = hostAddress;
        model = modelAddress;
    }

    modifier hostOnly() {
        require(msg.sender == host);
        _;
    }

    function setMainInterface(address value) hostOnly external returns(address oldValue) {
        oldValue = mainInterface;
        mainInterface = value;
    }

    function setHost(address value) hostOnly external returns(address oldValue) {
        oldValue = host;
        host = value;
    }

    function setModel(address value) external hostOnly returns(address oldValue) {
        oldValue = model;
        model = value;
    }

    function deploy(bytes calldata initPayload, address startingModel) external returns(address cloned, bytes memory initResponse) {
        address stm = startingModel != address(0) && msg.sender == host ? startingModel : model;
        emit ItemProjectionCreated(stm, cloned = _clone(stm), msg.sender, initResponse = IItemProjection(cloned).init(mainInterface, initPayload));
    }

    function _clone(address original) internal returns (address copy) {
        assembly {
            mstore(
                0,
                or(
                    0x5880730000000000000000000000000000000000000000803b80938091923cF3,
                    mul(original, 0x1000000000000000000)
                )
            )
            copy := create(0, 0, 32)
            switch extcodesize(copy)
                case 0 {
                    invalid()
                }
        }
    }
}