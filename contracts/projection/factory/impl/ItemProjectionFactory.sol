//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../model/IItemProjectionFactory.sol";
import "@ethereansos/swissknife/contracts/factory/impl/Factory.sol";

interface IMainIniterfaceMini {
    function init() external;
}

contract ItemProjectionFactory is Factory, IItemProjectionFactory {
    using ReflectionUtilities for address;

    address public override mainInterface;

    address[] private _models;

    constructor(bytes memory lazyInitData) Factory(lazyInitData) {
    }

    function _factoryLazyInit(bytes memory lazyInitData) internal override returns(bytes memory lazyInitResponse) {
        bytes[] memory modelCodes;
        (mainInterface, modelCodes) = abi.decode(lazyInitData, (address, bytes[]));
        IMainIniterfaceMini(mainInterface).init();
        for(uint256 i = 0; i < modelCodes.length; i++) {
            bytes memory code = modelCodes[i];
            address createdModel;
            assembly {
                createdModel := create(0, add(code, 0x20), mload(code))
            }
            require(createdModel != address(0), "model");
            _models.push(createdModel);
        }
        return "";
    }

    function models() external override view returns(address[] memory) {
        return _models;
    }

    function addModel(bytes memory code) external override authorizedOnly returns(address modelAddress, uint256 positionIndex) {
        if(code.length == 32) {
            modelAddress = abi.decode(code, (address));
        } else if(code.length == 20) {
            assembly {
                modelAddress := div(mload(add(code, 32)), 0x1000000000000000000000000)
            }
        } else {
            assembly {
                modelAddress := create(0, add(code, 32), mload(code))
            }
        }
        require(modelAddress != address(0), "model");
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(modelAddress)
        }
        require(codeSize > 0, "model");
        positionIndex = _models.length;
        _models.push(modelAddress);
    }

    function deploySingleton(bytes memory code, bytes calldata deployData) external authorizedOnly override returns(address deployedAddress, bytes memory deployLazyInitResponse) {
        assembly {
            deployedAddress := create(0, add(code, 0x20), mload(code))
        }
        deployLazyInitResponse = _deploy(address(0), deployedAddress, deployData);
    }

    function deploy(bytes calldata deployData) external payable override(Factory, IFactory) returns(address deployedAddress, bytes memory deployedLazyInitResponse) {
        uint256 modelIndex;
        (modelIndex, deployedLazyInitResponse) = abi.decode(deployData, (uint256, bytes));
        require(modelIndex < _models.length, "Model");
        address model = _models[modelIndex];
        deployedLazyInitResponse = _deploy(model, deployedAddress = model.clone(), deployedLazyInitResponse);
    }

    function _deploy(address model, address deployedAddress, bytes memory deployData) private returns(bytes memory deployedLazyInitResponse) {
        require(deployedAddress != address(0), "product");
        deployer[deployedAddress] = msg.sender;
        (address productHost, bytes memory lazyInitData) = abi.decode(deployData, (address, bytes));
        emit Deployed(model, deployedAddress, msg.sender, deployedLazyInitResponse = ILazyInitCapableElement(deployedAddress).lazyInit(abi.encode(productHost, abi.encode(mainInterface, lazyInitData))));
        require(ILazyInitCapableElement(deployedAddress).initializer() == address(this));
    }

    function _subjectIsAuthorizedFor(address, address, bytes4 selector, bytes calldata, uint256) internal override pure returns (bool, bool) {
        if(selector == this.setModelAddress.selector || selector == this.setDynamicUriResolver.selector) {
            return (true, false);
        }
        return (false, false);
    }
}