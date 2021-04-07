//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IENSController.sol";
import "../orchestrator/EthItemOrchestratorDependantElement.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract ENSController is IENSController, EthItemOrchestratorDependantElement {

    address private constant ENS_TOKEN_ADDRESS = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85;
    ENS private constant ENS_CONTROLLER = ENS(0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e);

    uint256 private _domainId;
    bytes32 private _domainNode;

    constructor(address doubleProxy) public EthItemOrchestratorDependantElement(doubleProxy) {
    }

    function _registerSpecificInterfaces() internal virtual override {
        _registerInterface(this.onERC721Received.selector);
    }

    function data() public override view returns(uint256 domainId, bytes32 domainNode) {
        domainId = _domainId;
        domainNode = _domainNode;
    }

    function attachENS(
        address ethItem,
        string memory ens
    ) public override byOrchestrator {

        bytes32 subdomainLabel = keccak256(bytes(ens));
        bytes32 subnode = keccak256(abi.encodePacked(_domainNode, subdomainLabel));

        require(!ENS_CONTROLLER.recordExists(subnode), "ENS Name already taken");

        address resolverAddress = ENS_CONTROLLER.resolver(_domainNode);

        ENS_CONTROLLER.setSubnodeRecord(
            _domainNode,
            subdomainLabel,
            resolverAddress == address(0) ? ethItem : address(this),
            resolverAddress,
            0
        );

        emit ENSAttached(ethItem, ens, ens);

        if (resolverAddress == address(0)) {
            return;
        }

        IResolver resolver = IResolver(resolverAddress);

        try resolver.setAddr(subnode, ethItem) {
        } catch {
        }

        try resolver.contenthash(_domainNode) returns (bytes memory contenthash) {
            try resolver.setContenthash(subnode, contenthash) {
            } catch {
            }
        } catch{
        }

        ENS_CONTROLLER.setOwner(subnode, ethItem);
    }

    function transfer(address receiver, bytes32 domainNode, uint256 domainId, bool reclaimFirst, bool safeTransferFrom, bytes memory payload) public override byOrchestrator {
        if(keccak256("") != domainNode) {
            ENS_CONTROLLER.setOwner(domainNode, receiver);
        }
        if(domainId != 0) {
            if(reclaimFirst) {
                ENSERC721(ENS_TOKEN_ADDRESS).reclaim(domainId, receiver);
            }
            if(!safeTransferFrom) {
                IERC721(ENS_TOKEN_ADDRESS).transferFrom(
                    address(this),
                    receiver,
                    domainId
                );
            } else {
                IERC721(ENS_TOKEN_ADDRESS).safeTransferFrom(
                    address(this),
                    receiver,
                    domainId,
                    payload
                );
            }
        }
    }

    function onERC721Received(
        address operator,
        address,
        uint256 domainId,
        bytes memory payload
    ) public virtual override returns (bytes4) {
        require(msg.sender == ENS_TOKEN_ADDRESS, "Unknown Token");
        require(isAuthorizedOrchestrator(operator), "Unauthorized Action");
        ENSERC721(ENS_TOKEN_ADDRESS).reclaim(_domainId = domainId, address(this));
        ENS_CONTROLLER.setOwner((_domainNode = abi.decode(payload, (bytes32))), address(this));
        return this.onERC721Received.selector;
    }
}

interface ENS {
    function resolver(bytes32 node) external view returns (address);

    function owner(bytes32 node) external view returns (address);

    function setOwner(bytes32 node, address ownerAddress) external;

    function recordExists(bytes32 node) external view returns (bool);

    function setSubnodeRecord(
        bytes32 node,
        bytes32 label,
        address,
        address,
        uint64 ttl
    ) external;
}

interface IResolver {
    function supportsInterface(bytes4 interfaceID) external view returns (bool);

    function setAddr(bytes32 node, address a) external;
    function setContenthash(bytes32 node, bytes calldata hash) external;
    function contenthash(bytes32 node) external view returns (bytes memory);
}

interface ENSERC721 {
    function reclaim(uint256 id, address owner) external;
}