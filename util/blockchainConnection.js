var Web3 = require('web3');
module.exports = {
    init: global.blockchainConnection = global.blockchainConnection || new Promise(async function(ok, ko) {
        try {
            (require('dotenv')).config();
            var options = {
                gasLimit: 10000000,
                db: require('memdown')(),
                total_accounts: 15,
                default_balance_ether: 9999999999999999999,
                asyncRequestProcessing : true,
            };
            if (process.env.blockchain_connection_string) {
                options.fork = process.env.blockchain_connection_string;
                options.gasLimit = parseInt((await new Web3(process.env.blockchain_connection_string).eth.getBlock("latest")).gasLimit * 1);
            }
            global.gasLimit = options.gasLimit;
            global.accounts = await (global.web3 = new Web3(global.blockchainProvider = require("ganache-core").provider(options), null, { transactionConfirmationBlocks: 1 })).eth.getAccounts();
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
        await new Promise(async function (ok) {
            async function consume() {
                if(--blocks < 0) {
                    return ok();
                }
                await web3.currentProvider.sendAsync({ "id": new Date().getTime() + blocks, "jsonrpc": "2.0", "method": "evm_mine", "params": [] }, consume);
            }
            consume();
        });
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
        return Promise.all((accountsInput = accountsInput instanceof Array ? accountsInput : [accountsInput]).map(it => new Promise(function(ok, ko) {
            try {
                web3.currentProvider.sendAsync({
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
                    try {
                        await web3.eth.sendTransaction({
                            to: it,
                            from: accounts[accounts.length - 1],
                            gasLimit: global.gasLimit,
                            value: web3.utils.toWei("99999", "ether")
                        });
                    } catch(e) {
                        return ko(e);
                    }
                    return ok((response && response.result) || response);
                });
            } catch(e) {
                return ko(e);
            }
        })));
    }
}