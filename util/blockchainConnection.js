var Web3 = require('web3');
var utils = require("ethereumjs-util");
module.exports = {
    init: global.blockchainConnection = global.blockchainConnection || new Promise(async function(ok, ko) {
        try {
            (require('dotenv')).config();
            var options = {
                gasLimit: 10000000,
                db: require('memdown')(),
                total_accounts: 15,
                default_balance_ether: 9999999999999999999
            };
            if (process.env.blockchain_connection_string) {
                options.fork = process.env.blockchain_connection_string;
                var block = await new Web3(process.env.blockchain_connection_string).eth.getBlock("latest");
                blockchainConnection.forkBlock = block.number + 1;
                options.gasLimit = parseInt(block.gasLimit * 0.79);
            }
            global.gasLimit = options.gasLimit;
            global.accounts = await (global.web3 = new Web3(global.blockchainProvider = require("ganache-core").provider(options), null, { transactionConfirmationBlocks: 1 })).eth.getAccounts();
            await global.blockchainConnection.fastForward(10);
            return ok(global.web3);
        } catch (e) {
            return ko(e);
        }
    }),
    getSendingOptions(edit) {
        return {
            ... {
                from: global.accounts[0],
                gasLimit: global.gasLimit
            },
            ...edit
        };
    },
    async fastForward(blocks) {
        var blockNumber = parseInt(await web3.eth.getBlockNumber()) + (blocks = blocks && parseInt(blocks) || 1);
        while (blocks-- > 0) {
            web3.currentProvider.sendAsync({ "id": new Date().getTime(), "jsonrpc": "2.0", "method": "evm_mine", "params": [] }, () => {});
        }
        while (parseInt(await web3.eth.getBlockNumber()) < blockNumber) {
            await new Promise(ok => setTimeout(ok, 1000));
        }
    },
    async jumpToBlock(block, notIncluded) {
        var currentBlock = await web3.eth.getBlockNumber();
        var blocks = block - currentBlock;
        notIncluded && blocks--;
        await this.fastForward(blocks);
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
        return Promise.all((accountsInput = accountsInput instanceof Array ? accountsInput : [accountsInput]).map(it => new Promise(async function(ok, ko) {
            try {
                await web3.currentProvider.sendAsync({
                    "id": new Date().getTime(),
                    "jsonrpc": "2.0",
                    "method": "evm_unlockUnknownAccount",
                    "params": [it = web3.utils.toChecksumAddress(it)]
                }, async function(error, response) {
                    if (error) {
                        return ko(error);
                    }
                    if (!response || !response.result) {
                        return ko((response && response.result) || response);
                    }
                    return ok((response && response.result) || response);
                });
            } catch(e) {
                return ko(e);
            }
        }))).then(() => global.blockchainConnection.safeTransferETH(accountsInput));
    },
    async safeTransferETH(accountsInput) {
        var forceBalance = [];
        await Promise.all((accountsInput = accountsInput instanceof Array ? accountsInput : [accountsInput]).map(it => new Promise(async function(ok, ko) {
            try {
                await web3.eth.sendTransaction({
                    to: it,
                    from: accounts[accounts.length - 1],
                    gasLimit: global.gasLimit,
                    value: web3.utils.toWei("99999", "ether")
                });
            } catch(e) {
                forceBalance.push(it);
            }
            return ok();
        })));
        if(forceBalance.length > 0) {
            var blockchain = global.blockchainProvider.manager.state.blockchain;
            var stateManager = blockchain.vm.stateManager;
            var accounts = await Promise.all(forceBalance.map(it => new Promise(function(ok) {
                blockchain.getAccount(it, function(_, account) {
                    account.balance = utils.toBuffer(9999999999999999999 * 1e18);
                    return ok({
                        address: utils.toBuffer(it.toLowerCase()),
                        account
                    });
                });
            })));
            await new Promise(function(ok) {
                blockchain.createBlock(function(_, block) {
                    stateManager.checkpoint(function() {
                        var putAccount = function() {
                            if(accounts.length === 0) {
                                return stateManager.commit(function() {
                                    blockchain.putBlock(block, [], [], ok);
                                });
                            }
                            var data = accounts.shift();
                            stateManager.putAccount(data.address, data.account, putAccount);
                        };
                        setTimeout(putAccount);
                    });
                });
            });
        }
    },
    async createAndUnlockContract(Compilation, args) {
        var contract = await new web3.eth.Contract(Compilation.abi).deploy({data : Compilation.bin, arguments : args || []}).send(blockchainConnection.getSendingOptions());
        await this.unlockAccounts(contract.options.address);
        return contract;
    }
}