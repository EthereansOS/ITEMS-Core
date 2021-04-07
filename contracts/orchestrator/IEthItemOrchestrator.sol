//SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

interface IEthItemOrchestrator is IERC721Receiver, IERC1155Receiver {

    function factories() external view returns(address[] memory);

    function factory() external view returns(address);

    function setFactory(address newFactory) external;

    function knowledgeBases() external view returns(address[] memory);

    function knowledgeBase() external view returns(address);

    function setKnowledgeBase(address newKnowledgeBase) external;

    function ENSController() external view returns (address);

    function setENSController(address newEnsController) external;

    function transferENS(address receiver, bytes32 domainNode, uint256 domainId, bool reclaimFirst, bool safeTransferFrom, bytes memory payload) external;

    /**
     * @dev GET - The DoubleProxy of the DFO linked to this Contract
     */
    function doubleProxy() external view returns (address);

    /**
     * @dev SET - The DoubleProxy of the DFO linked to this Contract
     * It can be done only through a Proposal in the Linked DFO
     * @param newDoubleProxy the new DoubleProxy address
     */
    function setDoubleProxy(address newDoubleProxy) external;

    /**
     * @dev SET - The address of the Smart Contract whose code will serve as a model for all the EthItemERC20Wrappers (please see the eth-item-token-standard for further information).
     * It can be done only through a Proposal in the Linked DFO
     */
    function setEthItemInteroperableInterfaceModel(address ethItemInteroperableInterfaceModelAddress) external;

    /**
     * @dev SET - The address of the Native EthItem model.
     * It can be done only through a Proposal in the Linked DFO
     */
    function setNativeModel(address nativeModelAddress) external;
    function addNativeModel(address nativeModelAddress) external;

    /**
     * @dev SET - The address of the ERC1155 NFT-Based EthItem model.
     * It can be done only through a Proposal in the Linked DFO
     */
    function setERC1155WrapperModel(address erc1155WrapperModelAddress) external;
    function addERC1155WrapperModel(address erc1155WrapperModelAddress) external;

    /**
     * @dev SET - The address of the Smart Contract whose code will serve as a model for all the Wrapped ERC20 EthItems.
     * It can be done only through a Proposal in the Linked DFO
     */
    function setERC20WrapperModel(address erc20WrapperModelAddress) external;
    function addERC20WrapperModel(address erc20WrapperModelAddress) external;

    /**
     * @dev SET - The address of the Smart Contract whose code will serve as a model for all the Wrapped ERC721 EthItems.
     * It can be done only through a Proposal in the Linked DFO
     */
    function setERC721WrapperModel(address erc721WrapperModelAddress) external;
    function addERC721WrapperModel(address erc721WrapperModelAddress) external;

    /**
     * @dev SET - The element useful to calculate the Percentage fee
     * It can be done only through a Proposal in the Linked DFO
     */
    function setMintFeePercentage(uint256 mintFeePercentageNumerator, uint256 mintFeePercentageDenominator) external;

    /**
     * @dev SET - The element useful to calculate the Percentage fee
     * It can be done only through a Proposal in the Linked DFO
     */
    function setBurnFeePercentage(uint256 burnFeePercentageNumerator, uint256 burnFeePercentageDenominator) external;

    function createNative(address modelAddress, bytes calldata modelInitPayload, string calldata ens)
        external
        returns (address newNativeAddress, bytes memory modelInitCallResponse);

    function createNative(bytes calldata modelInitPayload, string calldata ens)
        external
        returns (address newNativeAddress, bytes memory modelInitCallResponse);

    function createERC20Wrapper(bytes calldata modelInitPayload)
        external
        returns (address newEthItemAddress, bytes memory modelInitCallResponse);
}

interface IDoubleProxy {
    function proxy() external view returns (address);
}

interface IMVDProxy {
    function getMVDFunctionalitiesManagerAddress() external view returns(address);
    function getMVDWalletAddress() external view returns (address);
    function getStateHolderAddress() external view returns(address);
}

interface IMVDFunctionalitiesManager {
    function isAuthorizedFunctionality(address functionality) external view returns(bool);
}

interface IStateHolder {
    function getUint256(string calldata name) external view returns(uint256);
    function getAddress(string calldata name) external view returns(address);
    function clear(string calldata varName) external returns(string memory oldDataType, bytes memory oldVal);
}