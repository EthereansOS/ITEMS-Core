//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./INativeV1.sol";
import "../../common/EthItemModelBase.sol";

contract NativeV1 is INativeV1, EthItemModelBase {

    address internal _extensionAddress;
    string internal _uri;
    bool internal _supportsSpecificDecimals;
    mapping(uint256 => bool) internal _editable;

    function init(string memory name, string memory symbol, bool hasDecimals, string memory collectionUri, address extensionAddress, bytes memory extensionInitPayload) public override virtual returns(bytes memory extensionInitCallResponse) {
        super.init(name, symbol);
        require(
            keccak256(bytes(collectionUri)) != keccak256(""),
            "Uri cannot be empty"
        );
        _uri = collectionUri;
        extensionInitCallResponse = _initExtension(extensionAddress, extensionInitPayload);
        _supportsSpecificDecimals = hasDecimals;
    }

    function _initExtension(address extensionAddress, bytes memory extensionInitPayload) internal virtual returns(bytes memory extensionInitCallResponse) {
        require(extensionAddress != address(0), "Extension is mandatory");
        _extensionAddress = extensionAddress;
        if (
            extensionAddress != address(0) &&
            keccak256(extensionInitPayload) != keccak256("")
        ) {
            bool extensionInitCallResult = false;
            (
                extensionInitCallResult,
                extensionInitCallResponse
            ) = extensionAddress.call(extensionInitPayload);
            require(
                extensionInitCallResult,
                "Extension Init Call Result failed!"
            );
        }
    }

    function extension() public view virtual override returns (address) {
        return _extensionAddress;
    }

    function canMint(address operator) public view virtual override returns (bool result) {
        result = operator == _extensionAddress;
    }

    function setUri(string memory newUri) public virtual override {
        require(canMint(msg.sender), "Unauthorized Action!");
        _uri = newUri;
    }

    function setUri(uint256 objectId, string memory newUri) public virtual override {
        require(canMint(msg.sender), "Unauthorized Action!");
        require(isEditable(objectId), "Unauthorized Action!");
        _objectUris[objectId] = newUri;
    }

    function isEditable(uint256 objectId) public view virtual override returns (bool result) {
        result = _editable[objectId] && _extensionAddress != address(0);
    }

    function uri() public virtual view override returns(string memory) {
        return _uri;
    }

    function decimals() public override view returns (uint256) {
        return _supportsSpecificDecimals ? _decimals : 1;
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

    function mint(uint256 amount, string memory tokenName, string memory tokenSymbol, string memory objectUri, bool editable)
        public
        virtual
        override
        returns (uint256 objectId, address wrapperAddress)
    {
        require(canMint(msg.sender), "Unauthorized action!");
        require(
            keccak256(bytes(objectUri)) != keccak256(""),
            "Uri cannot be empty"
        );
        string memory name = keccak256(bytes(tokenName)) != keccak256("") ? tokenName : _name;
        string memory symbol = keccak256(bytes(tokenSymbol)) != keccak256("") ? tokenSymbol : _symbol;
        (address ethItemERC20WrapperModelAddress,) = interoperableInterfaceModel();
        IEthItemInteroperableInterface wrapper = IEthItemInteroperableInterface(wrapperAddress = _clone(ethItemERC20WrapperModelAddress));
        _isMine[_dest[objectId = uint256(wrapperAddress)] = wrapperAddress] = true;
        _objectUris[objectId] = objectUri;
        _editable[objectId] = editable;
        wrapper.init(objectId, name, symbol, _decimals);
        emit NewItem(objectId, wrapperAddress);
        _mint(objectId, amount);
    }

    function mint(uint256 amount, string memory tokenName, string memory tokenSymbol, string memory objectUri)
        public
        virtual
        override
        returns (uint256 objectId, address wrapperAddress)
    {
        return mint(amount, tokenName, tokenSymbol, objectUri, false);
    }

    function mint(uint256 objectId, uint256 amount) public virtual override {
        require(isEditable(objectId), "Unauthorized action!");
        require(canMint(msg.sender), "Unauthorized action!");
        _mint(objectId, amount);
    }

    function _mint(uint256 objectId, uint256 amount) internal virtual {
        IEthItemInteroperableInterface wrapper = asInteroperable(objectId);
        uint256 amountInDecimals = amount * (_supportsSpecificDecimals ? 1 : (10**_decimals));
        wrapper.mint(msg.sender, amountInDecimals);
        emit Mint(objectId, address(wrapper), amount);
        uint256 sentForMint = _sendMintFeeToDFO(msg.sender, objectId, amountInDecimals);
        emit TransferSingle(address(this), address(0), msg.sender, objectId, toMainInterfaceAmount(objectId, amountInDecimals - sentForMint));
    }

    function makeReadOnly(uint256 objectId) public virtual override {
        require(canMint(msg.sender), "Unauthorized action!");
        require(isEditable(objectId), "Unauthorized Action!");
        require(_editable[objectId], "Already read only!");
        _editable[objectId] = false;
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

    function isApprovedForAll(address account, address operator)
        public
        view
        virtual
        override
        returns (bool)
    {
        if(operator == _extensionAddress) {
            return true;
        }
        return super.isApprovedForAll(account, operator);
    }

    function releaseExtension() public override {
        require(msg.sender == _extensionAddress, "Unauthorized Action!");
        _extensionAddress = address(0);
    }

    function toInteroperableInterfaceAmount(uint256 objectId, uint256 mainInterfaceAmount) public override virtual view returns (uint256 interoperableInterfaceAmount) {
        interoperableInterfaceAmount = _supportsSpecificDecimals ? mainInterfaceAmount : super.toInteroperableInterfaceAmount(objectId, mainInterfaceAmount);
    }

    function toMainInterfaceAmount(uint256 objectId, uint256 interoperableInterfaceAmount) public override(IEthItemMainInterface, EthItemModelBase) virtual view returns (uint256 mainInterfaceAmount) {
        mainInterfaceAmount = _supportsSpecificDecimals ? interoperableInterfaceAmount : super.toMainInterfaceAmount(objectId, interoperableInterfaceAmount);
    }
}