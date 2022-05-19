var path = require('path');
var fs = require('fs');
var ganacheTransactionDebugger = require('./ganache-transactionDebugger');

var tracer = fs.readFileSync(path.resolve(__dirname, 'transactionTracer.js'), 'UTF-8');

var bytecodeCache = {};

function fixOpcodes(step) {
    if(!step) {
        return step
    }
    if(step.type === 'CREATE' || step.type === 'CREATE2') {
        var to = step.to
        if(step.steps) {
            for(var i in step.steps) {
                var stp = step.steps[i]
                stp.from = to
                step.steps[i] = stp
            }
        }
        if(step.logs) {
            for(var i in step.logs) {
                var stp = step.logs[i]
                stp.address = to
                step.logs[i] = stp
            }
        }
    }
    if(step.type === 'DELEGATECALL') {
        var from = step.from
        if(step.steps) {
            for(var i in step.steps) {
                var stp = step.steps[i]
                stp.from = from
                step.steps[i] = stp
            }
        }
        if(step.logs) {
            for(var i in step.logs) {
                var stp = step.logs[i]
                stp.address = from
                step.logs[i] = stp
            }
        }
    }

    if(step.steps) {
        for(var i in step.steps) {
            step.steps[i] = fixOpcodes(step.steps[i])
        }
    }

    return step
}

async function cleanAndGetBytecodes(web3, step, transaction) {
    try {
        if (!step) {
            return "0x";
        }
        if ((typeof step).toLowerCase() === 'string') {
            var bytecodeHash = bytecodeCache[step];
            if (bytecodeHash === undefined) {
                bytecodeCache[step] = bytecodeHash = web3.utils.sha3((await web3.eth.getCode(step)).split(step.toLowerCase()).join('0000000000000000000000000000000000000000'));
            }
            return bytecodeHash || "0x";
        }

        if (!step.parent) {
            step.blockHash = transaction.blockHash;
            step.blockNumber = transaction.blockNumber;
            step.transactionHash = transaction.transactionHash;
            step.type = transaction.contractAddress ? 'CREATE' : step.data === '0x' ? 'TRANSFER' : 'CALL';
            step.gasPrice = transaction.gasPrice;
            step.gas = transaction.gas;
            step.gasUsed = transaction.gasUsed;
            step.success = transaction.status;
        }
        delete step.parent;

        step.fromCodeHash = await cleanAndGetBytecodes(web3, step.from && (step.from = web3.utils.toChecksumAddress(step.from)), transaction);
        step.toCodeHash = await cleanAndGetBytecodes(web3, step.to && (step.to = web3.utils.toChecksumAddress(step.to)), transaction);

        if (step.logs && step.logs.length > 0) {
            for (var i in step.logs) {
                step.logs[i].blockHash = transaction.blockHash;
                step.logs[i].blockNumber = transaction.blockNumber;
                step.logs[i].transactionHash = transaction.transactionHash;
                try {
                    step.logs[i].addressCodeHash = await cleanAndGetBytecodes(web3, step.logs[i].address = web3.utils.toChecksumAddress(step.logs[i].address || step.to), transaction);
                } catch (e) {}
            }
        }

        if (step.steps && step.steps.length > 0) {
            for (var i in step.steps) {
                step.steps[i].parent = true;
                step.steps[i] = await cleanAndGetBytecodes(web3, step.steps[i], transaction);
            }
        }

        return step;
    } catch (e) {
        console.error(e);
    }
}

function debugTransaction(transactionHash, web3) {
    return Promise.all([
        web3.eth.getTransaction(transactionHash),
        web3.eth.getTransactionReceipt(transactionHash)
    ]).then(result => ganacheTransactionDebugger(web3, transactionHash, tracer, result)).then(transactionData => cleanAndGetBytecodes(web3, fixOpcodes(transactionData[0]), {...transactionData[1], ...transactionData[2] }));
}

function traceCall(transaction, web3) {
    return new Promise(function(ok, ko) {
        web3.currentProvider.sendAsync({
            "id": new Date().getTime(),
            "jsonrpc": "2.0",
            "method": "debug_traceCall",
            "params": [transaction, {
                tracer
            }]
        }, function(err, response) {
            return err ? ko(err) : cleanAndGetBytecodes(web3, response.result, {}).then(ok).catch(console.error);
        })
    });
}

module.exports = function transactionDebugger(web3, callback) {
    var debugBlock = function debugBlock(blockNumber, callback) {
        return web3.eth.getBlock(blockNumber).then(block => block && Promise.all(block.transactions.map(transactionHash => debugTransaction(transactionHash, web3)))).then(callback).catch(e => void(console.error(e), callback([])));
    };
    callback && web3.eth.subscribe('newBlockHeaders').on('data', data => debugBlock(data.number, callback));
    return {
        traceCall(transaction) {
            return traceCall(transaction, web3);
        },
        debugTransaction(transactionHash) {
            return debugTransaction(transactionHash, web3)
        },
        debugBlocks(fromBlock, toBlock) {
            var blockArray = [parseInt(fromBlock)];
            if (toBlock) {
                for (var i = parseInt(fromBlock) + 1; i <= parseInt(toBlock); i++) {
                    blockArray.push(i);
                }
            }
            var transactions = [];
            return new Promise(function(ok) {
                var callback = function callback(txns) {
                    transactions.push(...txns);
                    return blockArray.length === 0 ? ok(transactions) : debugBlock(blockArray.shift(), callback);
                }
                debugBlock(blockArray.shift(), callback);
            });
        }
    }
};