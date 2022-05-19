var Web3 = require('web3');
var utils = require("ethereumjs-util");
var gasCalculator = require("./gasCalculator");

function getInstrumentedGanache() {
    var fs = require('fs');
    var path = require('path');
    var relativePath = 'node_modules/ganache/dist/node/1.js';
    var halfPath = '';
    var filePath;
    while(true) {
        filePath = path.resolve(__dirname, halfPath, relativePath)
        if(fs.existsSync(filePath)) {
            break;
        }
        halfPath += '../';
    }

    var content = fs.readFileSync(filePath, "utf-8");
    var originalContent = fs.readFileSync(filePath, "utf-8");

    var update;

    var blockchain = 'd(this,a,A,"f")'
    if(content.indexOf(blockchain) !== -1) {
        content = content.split(blockchain).join('d(this,a,this.blockchain=A,"f")');
        update = true;
    }

    var executor = 'd(this,i,t,"f")';
    if(content.indexOf(executor) !== -1) {
        content = content.split(executor).join('d(this,i,this.executor=t,"f")');
        update = true;
    }

    var api = 'd(this,n,new y.default';
    if(content.indexOf(api) !== -1) {
        content = content.split(api).join('d(this,n,this.api=new y.default');
        update = true;
    }

    var simultaneousRequests = process.env.BLOCKCHAIN_SERVER_SIMULTANEOUS_REQUESTS || "0";
    var simultaneousRequestReplacer = 'const o=new s.RequestCoordinator(r?'
    if(content.indexOf(simultaneousRequestReplacer + simultaneousRequests) === -1) {
        var split = content.split(simultaneousRequestReplacer);
        var subSplit = split[1].split(':');
        subSplit[0] = simultaneousRequests;
        split[1] = subSplit.join(':');
        content = split.join(simultaneousRequestReplacer);
        update = true;
    }

    var queuePatch = ';setTimeout((function(){i(this,s,"f").call(this)}).bind(this));';
    var queueStart = 'this.runningTasks--,i(this,s,"f").call(this)}))'
    if(content.indexOf(queuePatch) === -1) {
        //content = content.split(queueStart).join(queueStart + queuePatch);
        update = true;
    }

    var requestCoordinatorStart = 'a=new s.Executor(';
    var requestCoordinatorPatch = 'global.requestCoordinator=';
    if(content.indexOf(requestCoordinatorStart + requestCoordinatorPatch) === -1) {
        content = content.split(requestCoordinatorStart).join(requestCoordinatorStart + requestCoordinatorPatch);
        update = true;
    }
    if(update) {
        try {
            fs.unlinkSync(filePath);
        } catch(e) {}
        fs.writeFileSync(filePath, content);
    }

    var Ganache = require("Ganache");

    try {
        fs.unlinkSync(filePath);
    } catch(e) {}
    fs.writeFileSync(filePath, originalContent);

    return Ganache;
}

module.exports = {
    init: global.blockchainConnection = global.blockchainConnection || new Promise(async function(ok, ko) {
        try {
            (require('dotenv')).config();
            var options = {
                miner : {
                    blockGasLimit : 10000000
                },
                chain : {
                    asyncRequestProcessing : true,
                    vmErrorsOnRPCResponse : true
                },
                wallet : {
                    totalAccounts : 15,
                    defaultBalance: 9999999999999999999
                },
                database : {
                    db: require('memdown')()
                }
            };
            if (process.env.blockchain_connection_string) {
                options.fork = {
                    url : process.env.blockchain_connection_string
                }
                process.env.fork_block_number && (options.fork.blockNumber = parseInt(process.env.fork_block_number));
                var block = await new Web3(process.env.blockchain_connection_string).eth.getBlock(options.fork.blockNumber || "latest");
                options.chain.chainId = await new Web3(process.env.blockchain_connection_string).eth.getChainId();
                blockchainConnection.forkBlock = block.number + 1;
                options.miner.blockGasLimit = parseInt(block.gasLimit * 0.79);
            }
            global.gasLimit = options.miner.blockGasLimit;
            global.gasPrice = process.env.BYPASS_GAS_PRICE === 'true' ? await gasCalculator() : null;
            var Ganache = getInstrumentedGanache();
            var onProvider = async function onProvider(provider) {
                global.accounts = await (global.web3 = new Web3(global.blockchainProvider = provider, null, { transactionConfirmationBlocks: 1 })).eth.getAccounts();
                global.web3.currentProvider.blockchainConnection = global.blockchainConnection;
                global.web3.currentProvider.accounts = global.accounts;
                provider.executor.oldExecute = provider.executor.execute;
                global.web3ForLogs = global.web3ForLogs || (process.env.BLOCKCHAIN_CONNECTION_FOR_LOGS_STRING ? new Web3(process.env.BLOCKCHAIN_CONNECTION_FOR_LOGS_STRING) : global.web3);
                var normalizeBlockNumber = (n, latestBlock) => n === undefined || n === null || n instanceof Number ? n : n === 'latest' || n === 'pending' ? latestBlock : parseInt(n);
                function instrumentExecutor(provider) {
                    const executor = provider.executor;
                    const oldExecute = executor.execute;
                    executor.execute = function execute() {
                        if((arguments[1] !== 'eth_getLogs' && arguments[1] !== 'evm_mine' && arguments[1] !== 'evm_addAccount') || (arguments[1] === 'eth_getLogs' && global.web3ForLogs === global.web3)) {
                            return oldExecute.apply(executor, arguments);
                        }
                        if(arguments[1] === 'evm_mine') {
                            var blocks;
                            try {
                                blocks = arguments[2][0].blocks;
                            } catch(e) {}
                            try {
                                if(arguments[2][0].timestamp) {
                                    var oldLimit = global.requestCoordinator.limit;
                                    global.requestCoordinator.limit = arguments[2][0].timestamp || oldLimit;
                                    global.requestCoordinator.resume();
                                    global.requestCoordinator.limit = oldLimit;
                                }
                            } catch(e) {}
                            var result = { value : new Promise(ok => ok("0x0")) };
                            return blocks ? blockchainConnection.fastForward(blocks).then(() => result) : new Promise(ok => ok(result));
                        }
                        if(arguments[1] === 'evm_addAccount') {
                            return blockchainConnection.unlockAccounts(arguments[2][0]).then(() => ({ value : new Promise(ok => ok("0x0")) })).catch(e => ({ value : new Promise((_, ko) => ko(e)) }));
                        }
                        var originalArguments = [...arguments];
                        return new Promise(async function(ok) {
                            try {
                                var args = originalArguments[2][0];

                                var latestBlock = await global.web3.eth.getBlockNumber();

                                var startBlock = normalizeBlockNumber(args.fromBlock, latestBlock) || 0;
                                var endBlock = normalizeBlockNumber(args.toBlock, latestBlock) || latestBlock;

                                startBlock = startBlock > endBlock ? 0 : startBlock;
                                endBlock = startBlock > endBlock ? latestBlock : endBlock;

                                var promises = [];
                                startBlock < blockchainConnection.forkBlock && (promises.push(global.web3ForLogs.eth.getPastLogs({
                                    ...args,
                                    fromBlock : startBlock,
                                    toBlock : endBlock >= blockchainConnection.forkBlock ? (blockchainConnection.forkBlock - 1) : endBlock
                                })));

                                if(endBlock >= blockchainConnection.forkBlock) {
                                    originalArguments[2][0] = {
                                        ...args,
                                        fromBlock : startBlock < blockchainConnection.forkBlock ? blockchainConnection.forkBlock : startBlock,
                                        toBlock : endBlock
                                    }
                                    promises.push((await oldExecute.apply(executor, originalArguments)).value)
                                }
                                promises = await Promise.all(promises);
                                promises = promises.reduce((acc, it) => ([...acc, ...it]), []);
                                return ok({ value : new Promise(ok => ok(promises))});
                            } catch(e) {
                                return ok({ value : new Promise((_, ko) => ko(e))});
                            }
                        });
                    }
                }
                instrumentExecutor(web3.currentProvider);
                process.env.BLOCKCHAIN_ADDRESSES_TO_UNLOCK && await global.blockchainConnection.unlockAccounts(JSON.parse(process.env.BLOCKCHAIN_ADDRESSES_TO_UNLOCK));
                await global.blockchainConnection.fastForward(10);
                return ok(global.web3);
            };
            if(process.env.blockchain_server_port) {
                var server = Ganache.server(options);
                return server.listen(parseInt(process.env.blockchain_server_port), err => err ? ko(err) : onProvider(server.provider));
            }
            return onProvider(Ganache.provider(options));
        } catch (e) {
            return ko(e);
        }
    }).catch(console.error),
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
            var createBlock = async () => blocks-- === 0 ? ok() : remote ? await web3.currentProvider.sendAsync({ "id": new Date().getTime(), "jsonrpc": "2.0", "method": "evm_mine", "params": [] }, createBlock) : global.blockchainProvider.blockchain.mine(-1, new Date().getTime(), blocks === 0).then(createBlock);
            createBlock();
        });
        while (parseInt(await web3.eth.getBlockNumber()) < blockNumber) {
            await new Promise(ok => setTimeout(ok, 1000));
        }
    },
    async jumpToBlock(block, notIncluded, remote) {
        var currentBlock = parseInt(await web3.eth.getBlockNumber());
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
    unlockAccounts(accountsInput, noMoney) {
        var accountsToUnlock = (accountsInput = accountsInput instanceof Array ? accountsInput : [accountsInput]).map(it => it);
        return new Promise(async function(ok, ko) {
            for(var address of accountsToUnlock) {
                try {
                    var account = web3.utils.toChecksumAddress(address);
                    await (await web3.currentProvider.executor.oldExecute(web3.currentProvider.api, "evm_addAccount", [account, ""])).value;
                    return (await web3.currentProvider.executor.oldExecute(web3.currentProvider.api, "personal_unlockAccount", [account, "", 0])).value.then(ok);
                } catch(e) {
                    return ko(e);
                }
            }
        }).then(() => !noMoney && global.blockchainConnection.safeTransferETH(accountsInput));
    },
    async safeTransferETH(accountsInput) {
        accountsInput = accountsInput instanceof Array ? accountsInput : [accountsInput];
        var number = new utils.BN(utilities.numberToString(99999*1e18));
        var stateManager = global.blockchainProvider.blockchain.vm.stateManager;
        await stateManager.checkpoint();
        for(var address of accountsInput) {
            var buf = Buffer.from(web3.utils.toChecksumAddress(address).substring(2), "hex");
            var account = await stateManager.getAccount({ buf });
            account.balance = number;
            await stateManager.putAccount({ buf }, account);
        }
        await stateManager.commit();
        await blockchainConnection.fastForward(1);
    },
    async createAndUnlockContract(Compilation, args) {
        var contract = await new web3.eth.Contract(Compilation.abi).deploy({ data: Compilation.bin, arguments: args || [] }).send(blockchainConnection.getSendingOptions());
        await this.unlockAccounts(contract.options.address);
        return contract;
    }
}