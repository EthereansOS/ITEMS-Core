var BlockchainDouble = require('ganache-core/lib/blockchain_double');
var to = require("ganache-core/lib/utils/to.js");
var { BN } = require('ethereumjs-util');

var regularTransactionTrace = BlockchainDouble.prototype.processTransactionTrace;
BlockchainDouble.prototype.processTransactionTrace = async function processTransactionTrace(hash, params, callback) {
    if(!params || !params.tracer) {
        return regularTransactionTrace.apply(this, arguments);
    }
    var self = this;
    var targetHash = to.hex(hash);
    var txHashCurrentlyProcessing = "";
    var vm;

    var tracer;
    try {
        tracer = Function(params.tracer)();
    } catch(e) {
        try {
            tracer = Function("return " + params.tracer)();
        } catch(ex) {
            callback(e);
        }
    }

    var logContracts = [];
    var firstContract;

    var logContractsEditor = {
        CALL(log) {
            var contractCaller = log.contract.getAddress();
            var stackLength = log.stack.length();
            var contractAddress = to.hex(log.stack.peek(stackLength - 2));
            var contractValue = log.stack.peek(stackLength - 3);
            var inputStart = to.number(log.stack.peek(stackLength - 4));
            var inputStop = inputStart + to.number(log.stack.peek(stackLength - 5));
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
            var contractAddress = to.hex(log.stack.peek(stackLength - 2));
            var contractValue = new BN(0);
            var inputStart = to.number(log.stack.peek(stackLength - 3));
            var inputStop = inputStart + to.number(log.stack.peek(stackLength - 4));
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
            var returnStart = to.number(log.stack.peek(stackLength - 1));
            var returnStop = to.number(log.stack.peek(stackLength - 2));
            logCTX.output = log.memory.slice(returnStart, returnStart + returnStop);
        }
    };

    var logCTX;

    var logDB = {
        getBalance(address) {
            return new Promise(function(ok, ko) {
                return self.getBalance(address, function(err, result) {
                    return err ? ko(err) : ok(result)
                });
            });
        },
        getNonce(address) {
            return new Promise(function(ok, ko) {
                return self.getNonce(address, function(err, result) {
                    return err ? ko(err) : ok(to.number(result))
                });
            });
        },
        getCode(address) {
            return new Promise(function(ok, ko) {
                return self.getCode(address, function(err, result) {
                    return err ? ko(err) : ok(result)
                });
            });
        },
        getState(address, hash) {
            return new Promise(function(ok, ko) {
                return self.getState(address, hash, function(err, result) {
                    return err ? ko(err) : ok(to.hex(result))
                });
            });
        },
        exists(address) {
            var _this = this;
            return new Promise(async function(ok, ko) {
                try {
                    if(to.number(await _this.getBalance(address)) > 0) {
                        return ok(true);
                    }
                    if(to.number(await _this.getNonce(address)) > 0) {
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

    function stepListener(event, next) {

        var logObject = {
            op : {
                isPush : () => event.opcode.name.indexOf('PUSH') === 0,
                toString : () => event.opcode.name,
                toNumber : () => 0
            },
            memory : {
                slice : (start, stop) => {
                    return event.memory.slice(start, stop).map(it => {
                        var x = new BN(it).toString('hex');
                        return x.length === 0 ? '00' : x.length === 1 ? ('0' + x) : x;
                    });
                },
                getUint : offset => new BN(event.memory[offset]).toString('hex')
            },
            stack : {
                peek : (idx) => event.stack[idx],
                length : () => event.stack.length
            },
            contract : logContracts[0] || firstContract,
            getPC : () => event.pc,
            getGas : () => to.number(event.gasLeft),
            getCost : () => event.opcode.fee,
            getRefund : () => event.refund || 0,
            getError : () => event.error || undefined
        };

        try {
            tracer.step && tracer.step.apply(tracer, [logObject, logDB]);
            logContractsEditor[event.opcode.name] && logContractsEditor[event.opcode.name](logObject);
            logObject.contract = logContracts[0];
        } catch(e) {
            return next(e);
        }

        next();
    }

    this.getTransactionReceipt(targetHash, function(err, receipt) {
        if (err) {
            return callback(err);
        }

        if (!receipt) {
            return callback(new Error("Unknown transaction " + targetHash));
        }

        try {
            var contractCaller = to.hex(receipt.tx.from);
            var contractAddress = receipt.contractAddress || to.hex(receipt.tx.to);
            var contractValue = parseInt("0x" + receipt.tx.value.toString('hex'));
            var contractInput = receipt.tx.input;
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
                gas : to.number(receipt.tx.gas),
                value : contractValue,
                block : to.number(receipt.block.header.number),
                output : [],
                gasUsed : to.number(receipt.gasUsed),
                time : new Date().getTime()
            };
        } catch(e) {
            console.error(e);
        }

        var targetBlock = receipt.block;

        self.getBlock(targetBlock.header.parentHash, function(err, parent) {
            if (err) {
                return callback(err);
            }

            var stateTrie = self.createStateTrie(self.data.trie_db, parent.header.stateRoot, {
                forkBlockNumber: to.number(parent.header.number)
            });
            vm = self.createVMFromStateTrie(stateTrie);

            self.createBlock(parent, false, function(err, block) {
                if (err) {
                    return callback(err);
                }

                block.header.timestamp = targetBlock.header.timestamp;

                for (var i = 0; i < targetBlock.transactions.length; i++) {
                    var tx = targetBlock.transactions[i];
                    block.transactions.push(tx);

                    if (to.hex(tx.hash()) === targetHash) {
                        break;
                    }
                }

                function beforeTxListener(tx) {
                    txCurrentlyProcessing = tx;
                    txHashCurrentlyProcessing = to.hex(tx.hash());
                    if (txHashCurrentlyProcessing === targetHash) {
                        vm.on("step", stepListener);
                    }
                }

                function afterTxListener() {
                    if (txHashCurrentlyProcessing === targetHash) {
                        removeListeners();
                    }
                }

                function removeListeners() {
                    vm.removeListener("step", stepListener);
                    vm.removeListener("beforeTx", beforeTxListener);
                    vm.removeListener("afterTx", afterTxListener);
                }

                vm.on("beforeTx", beforeTxListener);
                vm.on("afterTx", afterTxListener);

                vm.stateManager._cache.flush = (cb) => cb();

                self.processBlock(vm, block, false, function(err) {
                    if (err && (err.message.indexOf("VM Exception") === 0 || err.message.indexOf("Cannot get state root with uncommitted checkpoints") !== -1)) {
                        err = null;
                    }
                    removeListeners();
                    logCTX.time = ((new Date().getTime() - logCTX.time) / 1000) + '';
                    if(err) {
                        return callback(err);
                    }
                    try {
                        return callback(err, (tracer.result && tracer.result.apply(tracer, [logCTX, logDB])) || null);
                    } catch(e) {
                        return callback(e);
                    }
                });
            });
        });
    });
};