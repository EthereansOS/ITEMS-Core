var blockchainConnection = require("./blockchainConnection");
var utilities = require("./utilities");
var context = require("./context.json");
var compile = require("./compile");

async function createDFO(name, symbol, totalSupplyPlain, proposalLength, hardCapPlain, ensDomain) {
    var dfoHub = new web3.eth.Contract(context.dfoProxyABI, context.dfoHubProxyAddress);

    var data = {
        name,
        symbol,
        totalSupplyPlain,
        totalSupply : web3.utils.toWei(totalSupplyPlain.toString(), 'ether'),
        proposalLength,
        hardCapPlain,
        hardCap : web3.utils.toWei(hardCapPlain.toString(), 'ether'),
        ensDomain : ensDomain || `${name}_${symbol}_${new Date().getTime()}`
    };

    var payload = web3.eth.abi.encodeParameters(['address', 'uint256', 'string', 'string', 'uint256', 'uint256'], [
        utilities.voidEthereumAddress, 0,
        data.name,
        data.symbol,
        data.totalSupply,
        0
    ]);
    var response = await dfoHub.methods.submit('deployVotingToken', payload).send(blockchainConnection.getSendingOptions());
    response = formatDFOLogs(response.events.Event, "DFOCollateralContractsCloned(address_indexed,address,address,address)").raw.data;
    data.votingTokenAddress = response[0];
    data.stateHolderAddress = response[1];
    data.functionaltyModelsManagerAddress = response[2];

    payload = web3.eth.abi.encodeParameters(['address', 'uint256'], [utilities.voidEthereumAddress, 0]);
    response = await dfoHub.methods.submit('deployProposalsManager', payload).send(blockchainConnection.getSendingOptions());
    response = formatDFOLogs(response.events.Event, "DFOCollateralContractsCloned(address_indexed,address,address,address)").raw.data;
    data.mvdFunctionalityProposalManagerAddress = response[0];
    data.mvdWalletAddress = response[1];
    data.doubleProxyAddress = response[2];

    var params = ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'];
    var values = [
        utilities.voidEthereumAddress,
        0,
        data.proposalLength,
        data.proposalLength,
        0,
        0,
        data.hardCap,
        0,
        0
    ];
    payload = web3.eth.abi.encodeParameters(params, values);
    response = await dfoHub.methods.submit('deployGovernanceRules', payload).send(blockchainConnection.getSendingOptions());
    data.functionalitiesManagerAddress = formatDFOLogs(response.events.Event, "DFOCollateralContractsCloned(address_indexed,address)").raw.data[0];

    payload = web3.eth.abi.encodeParameters(['address', 'uint256', 'address', 'address', 'address', 'address', 'address', 'address', 'address', 'string'], [
        utilities.voidEthereumAddress,
        0,
        data.votingTokenAddress,
        data.mvdFunctionalityProposalManagerAddress,
        data.stateHolderAddress,
        data.functionaltyModelsManagerAddress,
        data.functionalitiesManagerAddress,
        data.mvdWalletAddress,
        data.doubleProxyAddress,
        data.ensDomain.toLowerCase()
    ]);
    response = await dfoHub.methods.submit('deployDFO', payload).send(blockchainConnection.getSendingOptions());
    data.dfoProxyAddress = formatDFOLogs(response.events.Event, "DFODeployed(address_indexed,address_indexed,address,address)").raw.data[0];

    data.proxy = new web3.eth.Contract(context.dfoProxyABI, data.dfoProxyAddress);
    data.votingToken = new web3.eth.Contract(context.dfoVotingTokenABI, data.votingTokenAddress);
    data.stateHolder = new web3.eth.Contract(context.dfoStateHolderABI, data.stateHolderAddress);
    data.functionalitiesManager = new web3.eth.Contract(context.dfoFunctionalitiesManagerABI, data.functionalitiesManagerAddress);

    return data;
}

async function loadDFOByDoubleProxy(doubleProxyAddress) {
    return loadDFOByProxy(await new web3.eth.Contract(context.dfoDoubleProxyABI, doubleProxyAddress).methods.proxy().call());
}

async function loadDFOByProxy(dfoProxyAddress) {
    var data = {
        dfoProxyAddress
    }
    data.proxy = new web3.eth.Contract(context.dfoProxyABI, data.dfoProxyAddress);

    try {
        data.doubleProxyAddress = await data.proxy.methods.getDoubleProxyAddress().call();
    } catch(e) {
    }
    data.mvdWalletAddress = await data.proxy.methods.getMVDWalletAddress().call();

    data.votingToken = new web3.eth.Contract(context.dfoVotingTokenABI, data.votingTokenAddress = await data.proxy.methods.getToken().call());
    data.stateHolder = new web3.eth.Contract(context.dfoStateHolderABI, data.stateHolderAddress = await data.proxy.methods.getStateHolderAddress().call());
    data.functionalitiesManager = new web3.eth.Contract(context.dfoFunctionalitiesManagerABI, data.functionalitiesManagerAddress = await data.proxy.methods.getToken().call());
    data.hardCap = web3.eth.abi.decodeParameter("uint256", await data.proxy.methods.read("getVotesHardCap", "0x").call());
    return data;
}

async function createProposal(dfo, codeName, submitable, code, methodSignature, internal, needsSender, replaces, args) {
    var compiled = await compile(code, "ProposalCode");
    var arguments = [
        ""
    ];
    args && arguments.push(...args);
    var contract = await new web3.eth.Contract(compiled.abi).deploy({data : compiled.bin, arguments}).send(blockchainConnection.getSendingOptions());
    var response = await dfo.proxy.methods.newProposal(
        codeName,
        false,
        utilities.voidEthereumAddress,
        0,
        contract.options.address,
        submitable,
        methodSignature || "",
        "[]",
        internal || false,
        needsSender || false,
        replaces || ""
    ).send(blockchainConnection.getSendingOptions());
    response = await web3.eth.getTransactionReceipt(response.transactionHash);
    var proposalAddress = web3.eth.abi.decodeParameter("address", response.logs.filter(it => it.topics[0] === web3.utils.sha3("Proposal(address)"))[0].data);
    var proposal = new web3.eth.Contract(context.dfoProposalABI, proposalAddress);
    return proposal;
}

async function finalizeProposal(dfo, proposal) {
    var result = await proposal.methods.accept(dfo.hardCap).send(blockchainConnection.getSendingOptions());
    result = await web3.eth.getTransactionReceipt(result.transactionHash);
    var log = result.logs.filter(it => it.topics[0] === web3.utils.sha3("ProposalSet(address,bool)"));
    if(log.length === 0) {
        throw Error("Error while running proposal");
    }
    log = log[0];
    var result = web3.eth.abi.decodeParameter("bool", log.data);
    if(!result) {
        throw new Error("Proposal set fail");
    }
}

function formatDFOLogs(logVar, event) {
    if (!logVar || (!this.isNaN(logVar.length) && logVar.length === 0)) {
        return logVar;
    }
    var logs = [];
    if (logVar.length) {
        logs.push(...logVar);
    } else {
        event = event || logVar.event;
        logs.push(logVar);
    }
    var deployArgs = [];
    if (event) {
        var rebuiltArgs = event.substring(event.indexOf('(') + 1);
        rebuiltArgs = JSON.parse('["' + rebuiltArgs.substring(0, rebuiltArgs.indexOf(')')).split(',').join('","') + '"]');
        for (var i in rebuiltArgs) {
            if (!rebuiltArgs[i].endsWith('_indexed')) {
                deployArgs.push(rebuiltArgs[i]);
            }
        }
    }
    var dfoEvent = web3.utils.sha3('Event(string,bytes32,bytes32,bytes)');
    var eventTopic = event && web3.utils.sha3(event);
    var manipulatedLogs = [];
    for (var i in logs) {
        var log = logs[i];
        if (log.topics && log.topics[0] !== dfoEvent) {
            continue;
        }
        log.topics && log.topics.splice(0, 1);
        if (eventTopic && log.topics && log.topics[0] !== eventTopic) {
            continue;
        }
        log.raw && log.raw.topics && log.raw.topics.splice(0, 1);
        try {
            log.data && (log.data = web3.eth.abi.decodeParameter("bytes", log.data));
            log.raw && log.raw.data && (log.raw.data = web3.eth.abi.decodeParameter("bytes", log.raw.data));
        } catch (e) {}
        if (deployArgs.length > 0 && (deployArgs.length > 1 || deployArgs[0] !== "")) {
            var data = web3.eth.abi.decodeParameters(deployArgs, log.data || (log.raw && log.raw.data));
            log.data && (log.data = []);
            log.raw && log.raw.data && (log.raw.data = []);
            Object.keys(data).map(key => {
                if (isNaN(parseInt(key))) {
                    return;
                }
                log.data && log.data.push(data[key]);
                log.raw && log.raw.data && log.raw.data.push(data[key]);
            });
        }
        manipulatedLogs.push(log);
    }
    return logVar.length ? manipulatedLogs : manipulatedLogs[0] || logVar;
};

module.exports = {
    createDFO,
    loadDFOByDoubleProxy,
    loadDFOByProxy,
    createProposal,
    finalizeProposal
}