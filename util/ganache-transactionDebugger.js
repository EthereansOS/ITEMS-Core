var { BN } = require('ethereumjs-util');

module.exports = async function(web3, transactionHash, tracerString, result) {

    var tracer;
    try {
        tracer = Function(tracerString)();
    } catch(e) {
        try {
            tracer = Function("return " + tracerString)();
        } catch(ex) {
            callback(e);
        }
    }

    var logContracts = [];
    var firstContract;
    var logCTX;

    var transaction = (result && result[0]) || await web3.eth.getTransaction(transactionHash);

    var transactionReceipt = (result && result[1]) || await web3.eth.getTransactionReceipt(transactionHash);

    var receipt = { ...transactionReceipt, ...transaction };

    var contractCaller = receipt.from;
    var contractAddress = receipt.contractAddress || receipt.to;
    var contractValue = parseInt(receipt.value || '0');
    var contractInput = receipt.input.substring(2);
    logContracts.unshift(firstContract = {
        getCaller : () => contractCaller,
        getAddress : () => contractAddress,
        getValue : () => contractValue,
        getInput : () => contractInput
    });
    logCTX = {
        type : receipt.contractAddress ? 'CREATE' : 'CALL',
        from : contractCaller,
        to : contractAddress,
        input : contractInput,
        gas : new BN(receipt.gas).toString(),
        value : contractValue,
        block : new BN(receipt.blockNumber).toString(),
        output : [],
        gasUsed : new BN(receipt.gasUsed).toString(),
        time : new Date().getTime()
    };

    var logContractsEditor = {
        CALL(log) {
            var contractCaller = log.contract.getAddress();
            var stackLength = log.stack.length();
            var contractAddress = log.stack.peek(stackLength - 2);
            var contractValue = log.stack.peek(stackLength - 3);
            var inputStart = parseInt("0x" + (log.stack.peek(stackLength - 4)));
            var inputStop = inputStart + parseInt("0x" + (log.stack.peek(stackLength - 5)));
            var contractInput = log.memory.slice(inputStart, inputStop);
            logContracts.unshift({
                getCaller : () => contractCaller,
                getAddress : () => contractAddress,
                getValue : () => contractValue,
                getInput : () => contractInput
            });
        },
        CALLCODE(log) {
            this.CALL(log);
        },
        STATICCALL(log) {
            var contractCaller = log.contract.getAddress();
            var stackLength = log.stack.length();
            var contractAddress = log.stack.peek(stackLength - 2);
            var contractValue = 0
            var inputStart = parseInt("0x" + (log.stack.peek(stackLength - 3).toString('hex')));
            var inputStop = inputStart + parseInt("0x" + (log.stack.peek(stackLength - 4).toString('hex')));
            var contractInput = log.memory.slice(inputStart, inputStop);
            logContracts.unshift({
                getCaller : () => contractCaller,
                getAddress : () => contractAddress,
                getValue : () => contractValue,
                getInput : () => contractInput
            });
        },
        DELEGATECALL(log) {
            this.STATICCALL(log);
        },
        STOP() {
            logContracts.shift();
        },
        INVALID() {
            this.STOP();
        },
        REVERT(log) {
            this.RETURN(log);
        },
        RETURN(log) {
            this.STOP();
            var stackLength = log.stack.length();
            var returnStart = parseInt("0x" + (log.stack.peek(stackLength - 1).toString('hex')));
            var returnStop = parseInt("0x" + (log.stack.peek(stackLength - 2).toString('hex')));
            logCTX.output = log.memory.slice(returnStart, returnStart + returnStop);
        }
    };

    var logDB = {
        getBalance(address) {
            return web3.eth.getBalance(address);
        },
        getNonce(address) {
            return web3.eth.getTransactionCount(address);
        },
        getCode(address) {
            return web3.eth.getCode(address);
        },
        getState(address, hash) {
            return web3.eth.getStorageAt(address, hash);
        },
        exists(address) {
            var _this = this;
            return new Promise(async function(ok, ko) {
                try {
                    if(new BN(await _this.getBalance(address)) > 0) {
                        return ok(true);
                    }
                    if(new BN(await _this.getNonce(address)) > 0) {
                        return ok(true);
                    }
                    if((await _this.getCode(address)).length > 0) {
                        return ok(true);
                    }
                    return ok(false);
                } catch(e) {
                    return ko(e);
                }
            });
        }
    }

    function step(event) {

        var logObject = {
            op : {
                isPush : () => event.opcode.name.indexOf('PUSH') === 0,
                toString : () => event.opcode.name,
                toNumber : () => 0
            },
            memory : {
                slice : (start, stop) => {
                    var sliced = event.memory.slice(start, stop);
                    var result = [];
                    for(var it of sliced) {
                        var x = new BN(it).toString('hex');
                        var converted = x.length === 0 ? '00' : x.length === 1 ? ('0' + x) : x;
                        result.push(converted);
                    }
                    return result;
                },
                getUint : offset => new BN(event.memory[offset]).toString('hex')
            },
            stack : {
                peek : (idx) => event.stack[idx],
                length : () => event.stack.length
            },
            contract : logContracts[0] || firstContract,
            getPC : () => event.pc,
            getGas : () => new BN(event.gasLeft).toString(),
            getCost : () => event.opcode.fee,
            getRefund : () => event.refund || 0,
            getError : () => event.error || undefined
        };

        tracer.step && tracer.step.apply(tracer, [logObject, logDB]);
        logContractsEditor[event.opcode.name] && logContractsEditor[event.opcode.name](logObject);
        logObject.contract = logContracts[0];
    }

    return await new Promise(async function(ok, ko) {
        var _context;
        var firstStepDone = false;
        function before(event) {
            web3.currentProvider.off("ganache:vm:tx:before", before);
            _context = _context || event.context;
        }
        function internalStep(event) {
            if(event.context !== _context) {
                return;
            }
            firstStepDone = true;
            try {
                step(event.data);
            } catch(e) {
                console.error(e);
                return ko(e);
            }
        }
        web3.currentProvider.on("ganache:vm:tx:before", before);
        web3.currentProvider.on("ganache:vm:tx:step", internalStep);
        await web3.currentProvider.sendAsync({
            "id": new Date().getTime(),
            "jsonrpc": "2.0",
            "method": "debug_traceTransaction",
            "params": [transactionHash, {
                disableStorage : true,
                disableMemory : true,
                disableStack : true
            }]
        }, function(err) {
            web3.currentProvider.off("ganache:vm:tx:step", internalStep);
            logCTX.time = ((new Date().getTime() - logCTX.time) / 1000) + '';
            if(err) {
                return ko(err);
            }
            try {
                (!firstStepDone || !_context) && internalStep({
                    context : (_context = _context || {}),
                    data : {opcode : {name : 'FAKE_INIT'}}
                });
                return ok([(tracer.result && tracer.result.apply(tracer, [logCTX, logDB])) || null, transaction, transactionReceipt]);
            } catch(e) {
                return ko(e);
            }
        })
    });
};