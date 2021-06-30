//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "../ItemProjection.sol";

contract NativeProjection is ItemProjection {

    bool private _decimalsZero;
    mapping(uint256 => bool) _finalized;

    constructor(bytes memory lazyInitData) ItemProjection(lazyInitData) {
    }

    function _projectionLazyInit(bytes memory collateralInitData) internal override returns (bytes memory) {
        (_decimalsZero) = abi.decode(collateralInitData, (bool));
        return "";
    }

    function decimals(uint256) override public view returns(uint256) {
        return _decimalsZero ? 0 : 18;
    }

    function mintItems(CreateItem[] calldata items, bool[] memory finalized) authorizedOnly public returns(uint256[] memory itemIds) {
        itemIds = IItemMainInterface(mainInterface).mintItems(items);
        for(uint256 i = 0; i < items.length; i++) {
            uint256 itemId = items[i].id;
            require(itemId == 0 || !_finalized[itemId], "Finalized");
            if(itemId == 0) {
                _finalized[itemIds[i]] = finalized[i];
            }
        }
    }

    function mintItems(CreateItem[] calldata items) authorizedOnly virtual override external returns(uint256[] memory itemIds) {
        return mintItems(items, new bool[](items.length));
    }
}