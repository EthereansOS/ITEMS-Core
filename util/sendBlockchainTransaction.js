var gasCalculator = require('./gasCalculator');
var { FeeMarketEIP1559Transaction } = require('@ethereumjs/tx');
const  Web3  = require('web3');
var web3 = new(require('web3'))();

var chainIdWeb3;

var getEtherscanAddress = function getEtherscanAddress(postFix, chainId) {
    var address = 'http://';
    if (chainId) {
        var idToNetwork = {
            1: '',
            3: 'ropsten',
            4: 'rinkeby',
            42: 'kovan'
        }
        var prefix = idToNetwork[parseInt(chainId)];
        prefix && (prefix += '.');
        address += prefix;
    }
    address += 'etherscan.io/';
    postFix && (address += postFix);
    return address;
};

function sendAsync(provider, method) {
    var params = [...arguments].slice(2) || [];
    return new Promise(async function(ok, ko) {
        try {
            await (provider.sendAsync || provider.send).call(provider, {
                "jsonrpc": "2.0",
                method,
                params,
                id: new Date().getTime()
            }, function(error, response) {
                return error || (response && response.error) ? ko(error || (response && response.error)) : ok(response && response.result);
            });
        } catch (e) {
            return ko(e);
        }
    });
}

module.exports = function sendBlockchainTransaction(provider, fromOrPlainPrivateKey, to, data, value, additionalData) {
    additionalData = additionalData || {};
    var address = fromOrPlainPrivateKey;
    var privateKey;
    try {
        address = web3.eth.accounts.privateKeyToAccount(fromOrPlainPrivateKey).address;
        privateKey = Buffer.from(fromOrPlainPrivateKey, 'hex');
    } catch (e) {}
    return new Promise(async(ok, ko) => {
        try {
            var chainId = chainIdWeb3 = chainIdWeb3 || (await (new Web3(provider)).eth.net.getId()) + '';
            var tx = {};
            var nonce = await sendAsync(provider, 'eth_getTransactionCount', address, "latest");
            nonce = web3.utils.toHex(nonce);
            tx.nonce = nonce;
            tx.from = address;
            to && (tx.to = to);
            tx.data = data;
            tx.type = "0x02";
            tx.value = web3.utils.toHex(value || '0');
            tx.chainId = web3.utils.toHex(chainId);

            var gasPrice = global.gasPrice;
            while(!gasPrice) {
                try {
                    console.log("gasPrice", gasPrice = await gasCalculator(), "GWEI");
                } catch(e) {
                    console.error("Gas price fail, retrying in 5 secs");
                    await new Promise(function(ok) {
                        setTimeout(ok, 5000)
                    })
                }
            }
            gasPrice = tx.chainId !== '0x1' && !provider.blockchainConnection ? "5" : gasPrice;
            gasPrice = web3.utils.toWei(gasPrice, 'gwei');
            gasPrice = web3.utils.toHex(gasPrice);

            if (provider.blockchainConnection) {
                try {
                    provider.accounts.indexOf(tx.from) === -1 && await provider.blockchainConnection.unlockAccounts(tx.from);
                } catch (e) {}
                delete tx.gas;
                tx.gasLimit = global.gasLimit;
                tx.gasPrice = gasPrice;
                return ok(await sendAsync(provider, 'eth_getTransactionReceipt', (await sendAsync(provider, 'eth_sendTransaction', tx))));
            }

            var lastBlock = (await sendAsync(provider, 'eth_getBlockByNumber', 'latest', false));

            if(!additionalData.gasLimit) {
                tx.gas = web3.utils.toHex(lastBlock.gasLimit);
                try {
                    tx.gas = web3.utils.toHex(web3.utils.toBN(parseInt(parseInt(await sendAsync(provider, 'eth_estimateGas', tx)) * (provider.blockchainConnection ? 1.3 : 1))).toString());
                } catch(e) {
                    console.log("GasLimit tentative 1 failed");
                    try {
                        tx.gas = web3.utils.toHex(web3.utils.toBN(parseInt(parseInt(await sendAsync(provider, 'eth_estimateGas', tx)))).toString());
                    } catch(e) {
                        console.log("GasLimit tentative 2 failed");
                        tx.gas = web3.utils.toHex(lastBlock.gasLimit);
                    }
                }
            } else {
                tx.gas = web3.utils.toHex(additionalData.gasLimit);
            }

            tx.maxFeePerGas = gasPrice;
            tx.maxPriorityFeePerGas = web3.utils.toHex(web3.utils.toBN(parseInt(parseInt(tx.maxFeePerGas) * 0.3)));
            tx.gasLimit = tx.gas;
            lastBlock.baseFeePerGas && (tx.baseFeePerGas = lastBlock.baseFeePerGas);

            await sendAsync(provider, 'eth_estimateGas', tx);
            var sendTransaction;
            if (privateKey) {
                var transaction = FeeMarketEIP1559Transaction.fromTxData(tx, {
                    chain: parseInt(chainId)
                });
                var signedTransaction = transaction.sign(privateKey);
                var serializedTx = '0x' + signedTransaction.serialize().toString('hex');
                sendTransaction = sendAsync(provider, 'eth_sendRawTransaction', serializedTx);
            } else {
                sendTransaction = sendAsync(provider, 'eth_sendTransaction', tx);
            }
            var transactionHash = await sendTransaction;
            console.log(new Date().toUTCString(), "Transaction!", getEtherscanAddress('tx/' + transactionHash, tx.chainId));
            var timeout = async function() {
                var receipt = await sendAsync(provider, 'eth_getTransactionReceipt', transactionHash);
                if (!receipt || !receipt.blockNumber || parseInt((await sendAsync(provider, 'eth_getBlockByNumber', 'latest', false)).number) <= (parseInt(receipt.blockNumber))) {
                    return setTimeout(timeout, 3000);
                }
                return ok(receipt);
            };
            setTimeout(timeout);
        } catch (e) {
            return ko(e);
        }
    });
}