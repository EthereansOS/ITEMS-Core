// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import "./IEthItemMainInterface.sol";
import "./IEthItemInteroperableInterface.sol";

/**
 * @title EthItem - An improved ERC1155 token with ERC20 trading capabilities.
 * @dev In the EthItem standard, there is no a centralized storage where to save every objectId info.
 * In fact every NFT data is saved in a specific ERC20 token that can also work as a standalone one, and let transfer parts of an atomic object.
 * The ERC20 represents a unique Token Id, and its supply represents the entire supply of that Token Id.
 * You can instantiate a EthItem as a brand-new one, or as a wrapper for pre-existent classic ERC1155 NFT.
 * In the first case, you can introduce some particular permissions to mint new tokens.
 * In the second case, you need to send your NFTs to the Wrapped EthItem (using the classic safeTransferFrom or safeBatchTransferFrom methods)
 * and it will create a brand new ERC20 Token or mint new supply (in the case some tokens with the same id were transfered before yours).
 */
contract EthItemMainInterface is IEthItemMainInterface, Context, ERC165 {
    using SafeMath for uint256;
    using Address for address;

    bytes4 internal constant _INTERFACEobjectId_ERC1155 = 0xd9b67a26;

    string internal _name;
    string internal _symbol;

    mapping(uint256 => string) internal _objectUris;

    mapping(uint256 => address) internal _dest;
    mapping(address => bool) internal _isMine;

    mapping(address => mapping(address => bool)) internal _operatorApprovals;

    address internal _interoperableInterfaceModel;
    uint256 internal _interoperableInterfaceModelVersion;

    uint256 internal _decimals;

    /**
     * @dev Constructor
     * When you create a EthItem, you can specify if you want to create a brand new one, passing the classic data like name, symbol, amd URI,
     * or wrap a pre-existent ERC1155 NFT, passing its contract address.
     * You can use just one of the two modes at the same time.
     * In both cases, a ERC20 token address is mandatory. It will be used as a model to be cloned for every minted NFT.
     * @param erc20NFTWrapperModel the address of the ERC20 pre-deployed model. I will not be used in the procedure, but just cloned as a brand-new one every time a new NFT is minted.
     * @param name the name of the brand new EthItem to be created. If you are wrapping a pre-existing ERC1155 NFT, this must be blank.
     * @param symbol the symbol of the brand new EthItem to be created. If you are wrapping a pre-existing ERC1155 NFT, this must be blank.
     */
    constructor(
        address erc20NFTWrapperModel,
        string memory name,
        string memory symbol
    ) public {
        if(erc20NFTWrapperModel != address(0)) {
            init(erc20NFTWrapperModel, name, symbol);
        }
    }

    /**
     * @dev Utility method which contains the logic of the constructor.
     * This is a useful trick to instantiate a contract when it is cloned.
     */
    function init(
        address interoperableInterfaceModel,
        string memory name,
        string memory symbol
    ) public virtual override {
        require(
            _interoperableInterfaceModel == address(0),
            "Init already called!"
        );

        require(
            interoperableInterfaceModel != address(0),
            "Model should be a valid ethereum address"
        );
        _interoperableInterfaceModelVersion = IEthItemInteroperableInterface(_interoperableInterfaceModel = interoperableInterfaceModel).interoperableInterfaceVersion();
        require(
            keccak256(bytes(name)) != keccak256(""),
            "Name is mandatory"
        );
        require(
            keccak256(bytes(symbol)) != keccak256(""),
            "Symbol is mandatory"
        );

        _name = name;
        _symbol = symbol;
        _decimals = 18;

        _registerInterface(this.safeBatchTransferFrom.selector);
        _registerInterface(_INTERFACEobjectId_ERC1155);
        _registerInterface(this.balanceOf.selector);
        _registerInterface(this.balanceOfBatch.selector);
        _registerInterface(this.setApprovalForAll.selector);
        _registerInterface(this.isApprovedForAll.selector);
        _registerInterface(this.safeTransferFrom.selector);
        _registerInterface(this.uri.selector);
        _registerInterface(this.totalSupply.selector);
        _registerInterface(0x00ad800c); //name(uint256)
        _registerInterface(0x4e41a1fb); //symbol(uint256)
        _registerInterface(this.decimals.selector);
        _registerInterface(0x06fdde03); //name()
        _registerInterface(0x95d89b41); //symbol()
    }

    function mainInterfaceVersion() public pure virtual override returns(uint256) {
        return 1;
    }

    /**
     * @dev Mint
     * If the EthItem does not wrap a pre-existent NFT, this call is used to mint new NFTs, according to the permission rules provided by the Token creator.
     * @param amount The amount of tokens to be created. It must be greater than 1 unity.
     * @param objectUri The Uri to locate this new token's metadata.
     */
    function mint(uint256 amount, string memory objectUri)
        public
        virtual
        override
        returns (uint256 objectId, address tokenAddress)
    {
        require(
            amount > 1,
            "You need to pass more than a token"
        );
        require(
            keccak256(bytes(objectUri)) != keccak256(""),
            "Uri cannot be empty"
        );
        (objectId, tokenAddress) = _mint(msg.sender, amount);
        _objectUris[objectId] = objectUri;
    }

    /**
     * @dev Burn
     * You can choose to burn your NFTs.
     * In case this Token wraps a pre-existent ERC1155 NFT, you will receive the wrapped NFTs.
     */
    function burn(
        uint256 objectId,
        uint256 amount
    ) public virtual override {
        uint256[] memory objectIds = new uint256[](1);
        objectIds[0] = objectId;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        _burn(msg.sender, objectIds, amounts);
        emit TransferSingle(msg.sender, msg.sender, address(0), objectId, amount);
    }

    /**
     * @dev Burn Batch
     * Same as burn, but for multiple NFTs at the same time
     */
    function burnBatch(
        uint256[] memory objectIds,
        uint256[] memory amounts
    ) public virtual override {
        _burn(msg.sender, objectIds, amounts);
        emit TransferBatch(msg.sender, msg.sender, address(0), objectIds, amounts);
    }

    function _burn(address owner, 
        uint256[] memory objectIds,
        uint256[] memory amounts) internal virtual {
        for (uint256 i = 0; i < objectIds.length; i++) {
            asInteroperable(objectIds[i]).burn(
                owner,
                toInteroperableInterfaceAmount(objectIds[i], amounts[i])
            );
        }
    }

    /**
     * @dev get the address of the ERC20 Contract used as a model
     */
    function interoperableInterfaceModel() public virtual override view returns (address, uint256) {
        return (_interoperableInterfaceModel, _interoperableInterfaceModelVersion);
    }

    /**
     * @dev Gives back the address of the ERC20 Token representing this Token Id
     */
    function asInteroperable(uint256 objectId)
        public
        virtual
        override
        view
        returns (IEthItemInteroperableInterface)
    {
        return IEthItemInteroperableInterface(_dest[objectId]);
    }

    /**
     * @dev Returns the total supply of the given token id
     * @param objectId the id of the token whose availability you want to know
     */
    function totalSupply(uint256 objectId)
        public
        virtual
        override
        view
        returns (uint256)
    {
        return toMainInterfaceAmount(objectId, asInteroperable(objectId).totalSupply());
    }

    /**
     * @dev Returns the name of the given token id
     * @param objectId the id of the token whose name you want to know
     */
    function name(uint256 objectId)
        public
        virtual
        override
        view
        returns (string memory)
    {
        return asInteroperable(objectId).name();
    }

    function name() public virtual override view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the given token id
     * @param objectId the id of the token whose symbol you want to know
     */
    function symbol(uint256 objectId)
        public
        virtual
        override
        view
        returns (string memory)
    {
        return asInteroperable(objectId).symbol();
    }

    function symbol() public virtual override view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the decimals of the given token id
     */
    function decimals(uint256)
        public
        virtual
        override
        view
        returns (uint256)
    {
        return 1;
    }

    /**
     * @dev Returns the uri of the given token id
     * @param objectId the id of the token whose uri you want to know
     */
    function uri(uint256 objectId)
        public
        virtual
        override
        view
        returns (string memory)
    {
        return _objectUris[objectId];
    }

    /**
     * @dev Classic ERC1155 Standard Method
     */
    function balanceOf(address account, uint256 objectId)
        public
        virtual
        override
        view
        returns (uint256)
    {
        return toMainInterfaceAmount(objectId, asInteroperable(objectId).balanceOf(account));
    }

    /**
     * @dev Classic ERC1155 Standard Method
     */
    function balanceOfBatch(
        address[] memory accounts,
        uint256[] memory objectIds
    ) public virtual override view returns (uint256[] memory balances) {
        balances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            balances[i] = balanceOf(accounts[i], objectIds[i]);
        }
    }

    /**
     * @dev Classic ERC1155 Standard Method
     */
    function setApprovalForAll(address operator, bool approved)
        public
        virtual
        override
    {
        address sender = _msgSender();
        require(
            sender != operator,
            "ERC1155: setting approval status for self"
        );

        _operatorApprovals[sender][operator] = approved;
        emit ApprovalForAll(sender, operator, approved);
    }

    /**
     * @dev Classic ERC1155 Standard Method
     */
    function isApprovedForAll(address account, address operator)
        public
        virtual
        override
        view
        returns (bool)
    {
        return _operatorApprovals[account][operator];
    }

    /**
     * @dev Classic ERC1155 Standard Method
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 objectId,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        require(to != address(0), "ERC1155: transfer to the zero address");
        address operator = _msgSender();
        require(
            from == operator || isApprovedForAll(from, operator),
            "ERC1155: caller is not owner nor approved"
        );

        asInteroperable(objectId).transferFrom(from, to, toInteroperableInterfaceAmount(objectId, amount));

        emit TransferSingle(operator, from, to, objectId, amount);

        _doSafeTransferAcceptanceCheck(
            operator,
            from,
            to,
            objectId,
            amount,
            data
        );
    }

    /**
     * @dev Classic ERC1155 Standard Method
     */
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory objectIds,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override {
        require(to != address(0), "ERC1155: transfer to the zero address");
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );

        for (uint256 i = 0; i < objectIds.length; i++) {
            asInteroperable(objectIds[i]).transferFrom(
                from,
                to,
                toInteroperableInterfaceAmount(objectIds[i], amounts[i])
            );
        }

        address operator = _msgSender();

        emit TransferBatch(operator, from, to, objectIds, amounts);

        _doSafeBatchTransferAcceptanceCheck(
            operator,
            from,
            to,
            objectIds,
            amounts,
            data
        );
    }

    function emitTransferSingleEvent(address sender, address from, address to, uint256 objectId, uint256 amount) public override {
        require(_dest[objectId] == msg.sender, "Unauthorized Action!");
        uint256 entireAmount = toMainInterfaceAmount(objectId, amount);
        if(entireAmount == 0) {
            return;
        }
        emit TransferSingle(sender, from, to, objectId, entireAmount);
    }

    function toInteroperableInterfaceAmount(uint256 objectId, uint256 mainInterfaceAmount) public override virtual view returns (uint256 interoperableInterfaceAmount) {
        interoperableInterfaceAmount = mainInterfaceAmount * (10**asInteroperable(objectId).decimals());
    }

    function toMainInterfaceAmount(uint256 objectId, uint256 interoperableInterfaceAmount) public override virtual view returns (uint256 mainInterfaceAmount) {
        mainInterfaceAmount = interoperableInterfaceAmount / (10**asInteroperable(objectId).decimals());
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal virtual {
        if (to.isContract()) {
            try
                IERC1155Receiver(to).onERC1155Received(
                    operator,
                    from,
                    id,
                    amount,
                    data
                )
            returns (bytes4 response) {
                if (
                    response != IERC1155Receiver(to).onERC1155Received.selector
                ) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual {
        if (to.isContract()) {
            try
                IERC1155Receiver(to).onERC1155BatchReceived(
                    operator,
                    from,
                    ids,
                    amounts,
                    data
                )
            returns (bytes4 response) {
                if (
                    response !=
                    IERC1155Receiver(to).onERC1155BatchReceived.selector
                ) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
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

    function _mint(
        address from,
        uint256 amount
    ) internal virtual returns (uint256 objectId, address wrapperAddress) {
        IEthItemInteroperableInterface wrapper = IEthItemInteroperableInterface(wrapperAddress = _clone(_interoperableInterfaceModel));
        _isMine[_dest[objectId = uint256(wrapperAddress)] = wrapperAddress] = true;
        wrapper.init(objectId, _name, _symbol, _decimals);
        wrapper.mint(from, amount * (10**_decimals));
        emit NewItem(objectId, wrapperAddress);
        emit Mint(objectId, wrapperAddress, amount);
        emit TransferSingle(address(this), address(0), from, objectId, amount);
    }
}