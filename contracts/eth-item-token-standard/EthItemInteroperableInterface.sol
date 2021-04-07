// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IEthItemInteroperableInterface.sol";
import "./IEthItemMainInterface.sol";

contract EthItemInteroperableInterface is Context, IEthItemInteroperableInterface {
    using SafeMath for uint256;
    using Address for address;

    mapping(address => uint256) internal _balances;

    mapping(address => mapping(address => uint256)) internal _allowances;

    uint256 internal _totalSupply;

    string internal _name;
    string internal _symbol;
    uint256 internal _decimals;

    address internal _mainInterface;
    uint256 internal _objectId;

    bytes32 internal DOMAIN_SEPARATOR;
    bytes32 internal TYPEHASH_PERMIT;
    mapping(address => uint) internal _permitNonces;

    function init(uint256 objectId, string memory name, string memory symbol, uint256 decimals) public virtual override {
        require(_mainInterface == address(0), "Init already called!");
        _mainInterface = msg.sender;
        _objectId = objectId;
        _name = name;
        _symbol = symbol;
        _decimals = decimals;
        _initSignatureStuff();
    }

    function _initSignatureStuff() private {
        uint chainId;
        assembly { chainId := chainid() }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes("Item")),
                keccak256(bytes('1')),
                chainId,
                address(this)
            )
        );
        _initSignatureMethods();
    }

    function interoperableInterfaceVersion() public pure virtual override returns(uint256) {
        return 1;
    }

    function _initSignatureMethods() internal virtual {
        TYPEHASH_PERMIT = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce)");
    }

    function permitNonce(address sender) public virtual view override returns(uint256) {
        return _permitNonces[sender];
    }

    function mainInterface() public virtual override view returns (address) {
        return _mainInterface;
    }

    function objectId() public virtual override view returns (uint256) {
        return _objectId;
    }

    function name() public virtual override view returns (string memory) {
        return _name;
    }

    function symbol() public virtual override view returns (string memory) {
        return _symbol;
    }

    function decimals() public virtual override view returns (uint256) {
        return _decimals;
    }

    function totalSupply() public virtual override view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account)
        public
        virtual
        override
        view
        returns (uint256)
    {
        return _balances[account];
    }

    function mint(address owner, uint256 amount) public virtual override {
        require(msg.sender == _mainInterface, "Unauthorized action!");
        _mint(owner, amount);
    }

    function burn(address owner, uint256 amount) public virtual override {
        require(
            msg.sender == _mainInterface,
            "Unauthorized action!"
        );
        _burn(owner, amount);
    }

    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender)
        public
        virtual
        override
        view
        returns (uint256 allowanceAmount)
    {
        allowanceAmount = _allowances[owner][spender];
        if (
            allowanceAmount == 0 &&
            IEthItemMainInterface(_mainInterface).isApprovedForAll(owner, spender)
        ) {
            allowanceAmount = _totalSupply;
        }
    }

    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        if (_msgSender() == _mainInterface) {
            return true;
        }
        if (
            !IEthItemMainInterface(_mainInterface).isApprovedForAll(
                sender,
                _msgSender()
            )
        ) {
            _approve(
                sender,
                _msgSender(),
                _allowances[sender][_msgSender()].sub(
                    amount,
                    "ERC20: transfer amount exceeds allowance"
                )
            );
        }
        return true;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _balances[sender] = _balances[sender].sub(
            amount,
            "ERC20: transfer amount exceeds balance"
        );
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
        if (_msgSender() != _mainInterface) {
            IEthItemMainInterface(_mainInterface).emitTransferSingleEvent(_msgSender(), sender, recipient, _objectId, amount);
        }
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _balances[account] = _balances[account].sub(
            amount,
            "ERC20: burn amount exceeds balance"
        );
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function permit(address owner, address spender, uint value, uint8 v, bytes32 r, bytes32 s) public override {
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(TYPEHASH_PERMIT, owner, spender, value, _permitNonces[owner]++))
            )
        );
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, 'INVALID_SIGNATURE');
        _approve(owner, spender, value);
    }
}