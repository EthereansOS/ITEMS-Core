var blockchainConnection = require("./blockchainConnection");
var utilities = require("./utilities");
var context = require("./context.json");
var dfoManager = require("./dfo");
var blockchainConnection = require("./blockchainConnection");

var tokenlessProposal = `pragma solidity ^${global.solidityVersion};

contract ProposalCode {

    string private constant TOKENLESS_VOTE_MICROSERVICE_NAME = "tokenlessVote";

    address private constant PROPOSAL_ADDRESS = {0};
    bool private constant ACCEPT = true;

    string private _metadataLink;

    constructor(string memory metadataLink) public {
        _metadataLink = metadataLink;
    }

    function getMetadataLink() public view returns(string memory) {
        return _metadataLink;
    }

    function callOneTime(address) public {
        IMVDProxy(msg.sender).submit(TOKENLESS_VOTE_MICROSERVICE_NAME, abi.encode(address(0), 0, IMVDFunctionalityProposal(PROPOSAL_ADDRESS).getProxy(), PROPOSAL_ADDRESS, ACCEPT));
    }
}

interface IMVDProxy {
    function submit(string calldata codeName, bytes calldata data) external payable returns(bytes memory returnData);
}

interface IMVDFunctionalityProposal {
    function getProxy() external view returns(address);
}`

var dfos = {};

var init = (global.dfoHubManagerInit = global.dfoHubManagerInit || new Promise(async(ok, ko) => {
    try {
        await blockchainConnection.init;
        dfos.NERV = await dfoManager.loadDFOByProxy(context.nervProxyAddress);
        dfos.dfoHub = await dfoManager.loadDFOByProxy(context.dfoHubProxyAddress);
        dfos.covenants = await dfoManager.loadDFOByProxy(context.covenantsProxyAddress);
        dfos.item = await dfoManager.loadDFOByProxy(context.itemProxyAddress);
        await blockchainConnection.unlockAccounts(context.nervTokenHolderAddress);
        await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            from: context.nervTokenHolderAddress,
            to: dfos.NERV.votingTokenAddress,
            data: dfos.NERV.votingToken.methods.transfer(accounts[0], await dfos.NERV.votingToken.methods.balanceOf(context.nervTokenHolderAddress).call()).encodeABI()
        }));
    } catch (e) {
        return ko(e);
    }
    return ok();
}));

module.exports = {
    dfos,
    init,
    createProposal(dfoName, codeName, submitable, code, methodSignature, internal, needsSender, replaces, args) {
        return dfoManager.createProposal(dfos[dfoName], codeName, submitable, code, methodSignature, internal, needsSender, replaces, args);
    },
    async finalizeProposal(originalProposal) {
        var code = tokenlessProposal.format(web3.utils.toChecksumAddress(originalProposal.options.address));
        var proposal = await dfoManager.createProposal(dfos.NERV, "", true, code, "callOneTime(address)");
        var proposalResponse = await dfoManager.finalizeProposal(dfos.NERV, proposal);
        return proposalResponse;
    }
}