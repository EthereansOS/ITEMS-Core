var Web3 = require('web3');
var utils = require("ethereumjs-util");
var gasCalculator = require("./gasCalculator");
module.exports = {
    init: global.blockchainConnection = global.blockchainConnection || new Promise(async function(ok, ko) {
        try {
            (require('dotenv')).config();
            var options = {
                gasLimit: 10000000,
                db: require('memdown')(),
                total_accounts: 15,
                default_balance_ether: 9999999999999999999,
                asyncRequestProcessing : true
            };
            if (process.env.blockchain_connection_string) {
                options.fork = process.env.blockchain_connection_string;
                var block = await new Web3(process.env.blockchain_connection_string).eth.getBlock("latest");
                blockchainConnection.forkBlock = block.number + 1;
                options.gasLimit = parseInt(block.gasLimit * 0.79);
            }
            global.gasLimit = options.gasLimit;
            global.gasPrice = await gasCalculator();
            var Ganache = require("ganache-core");
            var onProvider = async function onProvider(provider) {
                global.accounts = await (global.web3 = new Web3(global.blockchainProvider = provider, null, { transactionConfirmationBlocks: 1 })).eth.getAccounts();
                if(process.env.BLOCKCHAIN_CONNECTION_FOR_LOGS_STRING) {
                    global.web3.eth.getPastLogsLegacy = global.web3.eth.getPastLogs;
                    var normalizeBlockNumber = (n, latestBlock) => n === undefined || n === null || n instanceof Number ? n : n === 'latest' || n === 'pending' ? latestBlock : parseInt(n);
                    var tryManageLogs = async function tryManageLogs(args, callback, originalMethod) {
                        if(args.method !== 'eth_getLogs') {
                            return originalMethod.apply(provider, [args, callback]);
                        }
                        global.web3ForLogs = global.web3ForLogs || new Web3(process.env.BLOCKCHAIN_CONNECTION_FOR_LOGS_STRING);

                        var latestBlock = (await global.web3.eth.getBlock('latest')).number;

                        var startBlock = normalizeBlockNumber(args.params[0].fromBlock, latestBlock) || 0;
                        var endBlock = normalizeBlockNumber(args.params[0].toBlock, latestBlock) || latestBlock;

                        startBlock = startBlock > endBlock ? 0 : startBlock;
                        endBlock = startBlock > endBlock ? latestBlock : endBlock;

                        var remoteLogsPromise;
                        startBlock < blockchainConnection.forkBlock && (remoteLogsPromise = global.web3ForLogs.eth.getPastLogs({
                            ...args.params[0],
                            fromBlock : startBlock,
                            toBlock : endBlock >= blockchainConnection.forkBlock ? (blockchainConnection.forkBlock - 1) : endBlock
                        }));

                        var localArgs;
                        endBlock >= blockchainConnection.forkBlock && (localArgs = {
                            ...args.params[0],
                            fromBlock : startBlock < blockchainConnection.forkBlock ? blockchainConnection.forkBlock : startBlock,
                            toBlock : endBlock
                        });

                        var newCallback = (error, response) => error || !remoteLogsPromise ? setTimeout(() => callback(error, response)) : remoteLogsPromise.then(logs => setTimeout(() => callback(error, {...response, result : [...logs, ...(response.result || [])]})));

                        return !localArgs ? newCallback(undefined, args) : originalMethod.apply(provider, [{...args, params : [localArgs]}, newCallback]);
                    };

                    var oldSend = provider.send;
                    provider.send = (args, callback) => tryManageLogs(args, callback, oldSend);
                    var oldSendAsync = provider.sendAsync;
                    provider.sendAsync = (args, callback) => tryManageLogs(args, callback, oldSendAsync);
                }
                await global.blockchainConnection.fastForward(10);
                if(process.env.BLOCKCHAIN_ADDRESSES_TO_UNLOCK) {
                    await global.blockchainConnection.unlockAccounts(JSON.parse(process.env.BLOCKCHAIN_ADDRESSES_TO_UNLOCK));
                }
                return ok(global.web3);
            };
            if(process.env.blockchain_server_port) {
                var server = Ganache.server(options);
                return server.listen(process.env.blockchain_server_port, err => err ? ko(err) : onProvider(server.provider));
            }
            return onProvider(Ganache.provider(options));
        } catch (e) {
            return ko(e);
        }
    }),
    getSendingOptions(edit) {
        return {
            from: global.accounts[0],
            gasLimit: global.gasLimit,
            gasPrice : utilities.toDecimals(global.gasPrice, 9),
            ...edit
        };
    },
    async fastForward(blocks, remote) {
        var blockNumber = parseInt(await web3.eth.getBlockNumber()) + (blocks = blocks && parseInt(blocks) || 1);
        await new Promise(function(ok) {
            var createBlock = async () => blocks-- === 0 ? ok() : remote ? await web3.currentProvider.sendAsync({ "id": new Date().getTime(), "jsonrpc": "2.0", "method": "evm_mine", "params": [] }, createBlock) : global.blockchainProvider.manager.state.blockchain.createBlock((_, block) => global.blockchainProvider.manager.state.blockchain.putBlock(block, [], [], createBlock));
            createBlock();
        });
        while (parseInt(await web3.eth.getBlockNumber()) < blockNumber) {
            await new Promise(ok => setTimeout(ok, 1000));
        }
    },
    async jumpToBlock(block, notIncluded, remote) {
        var currentBlock = await web3.eth.getBlockNumber();
        var blocks = block - currentBlock;
        notIncluded && blocks--;
        await this.fastForward(blocks, remote);
    },
    async calculateTransactionFee(txn) {
        try {
            var transactionHash = txn.transactionHash || txn;
            var transactionReceipt = await web3.eth.getTransactionReceipt(transactionHash);
            var transaction = await web3.eth.getTransaction(transactionHash);
            var cost = web3.utils.toBN(transactionReceipt.gasUsed).mul(web3.utils.toBN(transaction.gasPrice));
            return cost.toString();
        } catch (error) {
            return '0';
        }
    },
    unlockAccounts(accountsInput) {
        var accountsToUnlock = (accountsInput = accountsInput instanceof Array ? accountsInput : [accountsInput]).map(it => it);
        return new Promise(function(ok, ko) {
            var unlock = async function unlock(error, response) {
                if (error) {
                    return ko(error);
                }
                if(accountsToUnlock.length === 0) {
                    if (!response || !response.result) {
                        return ko((response && response.result) || response);
                    }
                    return ok((response && response.result) || response);
                }
                try {
                    await web3.currentProvider.sendAsync({
                        "id": new Date().getTime(),
                        "jsonrpc": "2.0",
                        "method": "evm_unlockUnknownAccount",
                        "params": [web3.utils.toChecksumAddress(accountsToUnlock.shift())]
                    }, unlock);
                } catch (e) {
                    return ko(e);
                }
            }
            unlock();
        }).then(() => global.blockchainConnection.safeTransferETH(accountsInput));
    },
    async safeTransferETH(accountsInput) {
        accountsInput = accountsInput instanceof Array ? accountsInput : [accountsInput];
        var previousBalances = {};
        await Promise.all(accountsInput.map(async it => previousBalances[it] = parseInt(await web3.eth.getBalance(it))));
        var blockchain = global.blockchainProvider.manager.state.blockchain;
        var stateManager = blockchain.vm.stateManager;
        var accounts = [];
        var index = 0;
        await new Promise(function(ok, ko) {
            var onAccount = function onAccount(error, account) {
                if(error) {
                    return ko(error);
                }
                if(account) {
                    account.balance = utils.toBuffer((9999999999999999999 * 1e18) + previousBalances[accountsInput[index]]);
                    accounts.push({
                        address: utils.toBuffer(accountsInput[index++].toLowerCase()),
                        account
                    });
                }
                if(index === accountsInput.length) {
                    return ok();
                }
                blockchain.getAccount(accountsInput[index], onAccount);
            };
            onAccount();
        });
        await new Promise(function(ok) {
            blockchain.createBlock(function(_, block) {
                stateManager.checkpoint(function() {
                    var putAccount = function() {
                        if (accounts.length === 0) {
                            return stateManager.commit(function() {
                                blockchain.putBlock(block, [], [], ok);
                            });
                        }
                        var data = accounts.shift();
                        stateManager.putAccount(data.address, data.account, putAccount);
                    };
                    putAccount();
                });
            });
        });
    },
    async createAndUnlockContract(Compilation, args) {
        var contract = await new web3.eth.Contract(Compilation.abi).deploy({ data: Compilation.bin, arguments: args || [] }).send(blockchainConnection.getSendingOptions());
        await this.unlockAccounts(contract.options.address);
        return contract;
    }
}