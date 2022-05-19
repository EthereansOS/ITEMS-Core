global.debug = global.debug || (typeof v8debug === 'object' || /--debug|--inspect/.test(process.execArgv.join(' ')));
global.blockchainConnection = require("./blockchainConnection");
global.blockchainCall = require('./blockchainCall');
global.deployContract = require('./deployContract');
global.assert = require("assert");
global.assert.equal = assert.strictEqual;
global.utilities = require("./utilities");
global.knowledgeBase = require("./knowledgeBase.json");
global.compile = require("./compile");
global.onTheFly = require("./onTheFly");
global.abi = new(require('ethers')).utils.AbiCoder();

global.catchCall = async function catchCall(funct, message, print) {
    var done = false;
    try {
        if (funct.send) {
            await funct.send(blockchainConnection.getSendingOptions());
        } else if (funct.then) {
            await funct;
        } else {
            var f = funct();
            f.then && await f();
        }
        done = true;
    } catch (e) {
        print && console.error(e);
        (!message || message.toLowerCase() === 'revert') && assert.strictEqual((e.message || e).indexOf('revert'), (e.message || e).length - ('revert'.length), e.message || e);
        message && message.toLowerCase() !== 'revert' && assert.notStrictEqual((e.message || e).toLowerCase().indexOf(message.toLowerCase()), -1, e.message || e);
        return e.receipt || await web3.eth.getTransactionReceipt(e.data.hash);
    }
    assert(!done, "This shouldn't happen");
};

global.onCompilation = function onCompilation(contract) {
    if (!global.web3Util) {
        var Web3 = require('web3');
        global.web3Util = new Web3();
    }
    (global.compiledContracts = global.compiledContracts || {})[global.web3Util.utils.sha3("0x" + contract['bin-runtime'])] = {
        name: contract.contractName,
        abi: contract.abi
    };
    (global.contractsInfo = global.contractsInfo || {})[global.web3Util.utils.sha3(JSON.stringify(contract.abi))] = contract;
}

var startBlock;
var testBatteryTitle;
var currentTestTitle;

function setupTransactionDebugger(web3) {
    var provider = web3.currentProvider;
    const executor = provider.executor;
    const oldExecute = executor.execute;
    executor.execute = function execute() {
        if(arguments[1] === 'evm_mine' && global.appendTransactions) {
            return oldExecute.apply(executor, arguments).then(res => res.value.then(() => dumpBlocks(true).then(() => res)).catch(() => dumpBlocks(true).then(() => res)));
        }
        var batteryTitle = testBatteryTitle;
        var testTitle = currentTestTitle;
        var key = batteryTitle + " - " + (testTitle || "");
        if ((arguments[1] !== 'eth_sendTransaction' && arguments[1] !== 'eth_sendSignedTransaction' && arguments[1] !== 'eth_sendRawTransaction') || !startBlock || ((global.transactionLabels = global.transactionLabels || {})[key] && !global.appendTransactions)) {
            return oldExecute.apply(executor, arguments);
        }
        if(!global.appendTransactions) {
            global.transactionLabels[key] = true;
        }
        return oldExecute.apply(executor, arguments).then(res => res.value.then(response => {
            if(global.appendTransactions) {
                return dumpBlocks(true).then(() => res);
            }
            (response = response.result || response) && (global.transactionLabels[key] = response.toString());
            return res;
        }).catch(e => {
            if(global.appendTransactions) {
                return dumpBlocks(true).then(() => res);
            }
            global.transactionLabels[key] = e.data.hash;
            return res;
        }));
    };
    var path = require('path');
    var fs = require('fs');
    var buildPath = path.resolve(__dirname, '../build');
    try {
        fs.mkdirSync(buildPath);
    } catch (e) {}
    var jsonPath = path.resolve(buildPath, 'dump.json');
    try {
        fs.unlinkSync(jsonPath);
    } catch (e) {}
    global.transactionDebugger = require('./transactionDebugger')(web3);
    var OldContract = web3.eth.Contract;
    web3.eth.Contract = function Contract(abi, address) {
        var contract = (global.contractsInfo = global.contractsInfo || {})[web3.utils.sha3(JSON.stringify(abi))];
        var oldContract = new OldContract(...arguments);
        try {
            oldContract.name = contract.contractName;
            oldContract.abi = contract.abi;
            address && web3.eth.getCode(address).then(code => {
                var key = web3.utils.sha3(code);
                (global.compiledContracts = global.compiledContracts || {})[key] = {
                    name: oldContract.name,
                    abi: oldContract.abi
                };
            });
            var oldDeploy = oldContract.deploy;
            oldContract.deploy = function deploy() {
                var dep = oldDeploy.apply(oldContract, arguments);
                var oldSend = dep.send;
                dep.send = function send() {
                    return oldSend.apply(oldContract, arguments).then(deployedContract => {
                        var address = deployedContract.options.address;
                        var set = async() => {
                            try {
                                var key = web3.utils.sha3(await web3.eth.getCode(address));
                                if (!key) {
                                    setTimeout(set);
                                }
                                (global.compiledContracts = global.compiledContracts || {})[key] = {
                                    name: oldContract.name,
                                    abi: oldContract.abi
                                };
                            } catch (e) {}
                        };
                        setTimeout(set);
                        return deployedContract;
                    });
                };
                return dep;
            };
        } catch (e) {}
        return oldContract;
    };
}

async function initDFOHubManager() {
    /*global.dfoManager = require('./dfo');
    global.dfoHubManager = require('./dfoHub');
    await global.dfoHubManager.init;*/
    startBlock = parseInt((await global.web3.eth.getBlock('latest')).number) + 1;
}

async function dumpBlocks(append) {

    var path = require('path');
    var fs = require('fs');
    var buildPath = path.resolve(__dirname, '../build');
    try {
        fs.mkdirSync(buildPath);
    } catch (e) {}
    var jsonPath = path.resolve(buildPath, 'dump.json');

    var startOrAppendedBlock = startBlock;

    var transactions = [];
    if(append) {
        try {
            transactions = JSON.parse(fs.readFileSync(jsonPath, "utf-8")).transactions;
            startOrAppendedBlock = transactions.length === 0 ? startOrAppendedBlock : (parseInt(transactions[transactions.length - 1].blockNumber) + 1);
        } catch(e) {}
    }

    transactions.push(...(await global.transactionDebugger.debugBlocks(startOrAppendedBlock, await global.web3.eth.getBlockNumber())));
    transactions = transactions.filter(it => !global.bypassedTransactions || !global.bypassedTransactions[it.transactionHash]);
    var wellknownAddresses = {};
    global.accounts.forEach((it, i) => wellknownAddresses[it] = `Ganache Account ${i}`);

    try {
        fs.unlinkSync(jsonPath);
    } catch (e) {}
    try {
        fs.writeFileSync(jsonPath, JSON.stringify({ transactions, compiledContracts: global.compiledContracts, wellknownAddresses, transactionLabels : global.transactionLabels }, null, 4));
    } catch (e) {
        console.error(e);
    }
}

exports.mochaHooks = {
    beforeAll(done) {
        testBatteryTitle = undefined;
        currentTestTitle = undefined;
        Promise.all([
            blockchainConnection.init.then(setupTransactionDebugger).then(initDFOHubManager)
        ]).then(() => done()).catch(done);
    },
    afterAll(done) {
        Promise.all([
            dumpBlocks()
        ]).then(() => (global.appendTransactions = process.env.BLOCKCHAIN_SERVER_PORT) ? console.log("=== DONE ===", "Process PID", process.pid) : done()).catch(done);
    },
    beforeEach() {
        testBatteryTitle = this.currentTest.parent.title;
        currentTestTitle = this.currentTest.title;
        global.transactionLabels && global.transactionLabels["undefined - "] && (global.transactionLabels[testBatteryTitle + " - "] = global.transactionLabels["undefined - "]);
        global.transactionLabels && delete global.transactionLabels["undefined - "];
    }
};