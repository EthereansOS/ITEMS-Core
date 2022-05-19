return {
    tx: null,
    currentStep: null,
    callbacks: {
        STATICCALL(step, currentStep) {
            var data = step.sliceMemory(parseInt(step.stack[2]), parseInt(step.stack[3]));
            var { method, params } = this.extractMethodAndParams(data);
            currentStep.steps.push({
                type: step.op,
                parent: currentStep,
                gas: this.toNumberString(step.stack[0]),
                gasCost: this.numberToString(step.gasCost),
                from: step.from,
                to: this.decodeAddress(step.stack[1]),
                value: '0',
                data,
                steps: [],
                logs: [],
                result: "0x",
                success: true,
                method,
                params
            });
            return currentStep.steps[currentStep.steps.length - 1];
        },
        DELEGATECALL(step, currentStep) {
            var data = step.sliceMemory(parseInt(step.stack[2]), parseInt(step.stack[3]));
            var { method, params } = this.extractMethodAndParams(data);
            currentStep.steps.push({
                type: step.op,
                parent: currentStep,
                gas: this.toNumberString(step.stack[0]),
                gasCost: this.numberToString(step.gasCost),
                from: step.from,
                to: this.decodeAddress(step.stack[1]),
                value: '0',
                data,
                steps: [],
                logs: [],
                result: "0x",
                success: true,
                method,
                params
            });
            return currentStep.steps[currentStep.steps.length - 1];
        },
        CALL(step, currentStep, tx) {
            var data = step.sliceMemory(parseInt(step.stack[3]), parseInt(step.stack[4]));
            var { method, params } = this.extractMethodAndParams(data);
            var type = !tx.incomplete && (!data || data === '0x') ? 'TRANSFER' : step.op;
            currentStep.steps.push({
                type,
                parent: currentStep,
                gas: this.toNumberString(step.stack[0]),
                gasCost: this.numberToString(step.gasCost),
                from: step.from,
                to: this.decodeAddress(step.stack[1]),
                value: this.toNumberString(step.stack[2]),
                data,
                steps: [],
                logs: [],
                result: "0x",
                success: true,
                method,
                params
            });
            return type === 'TRANSFER' ? currentStep : currentStep.steps[currentStep.steps.length - 1];
        },
        CALLCODE(step, currentStep) {
            var data = step.sliceMemory(parseInt(step.stack[3]), parseInt(step.stack[4]));
            var { method, params } = this.extractMethodAndParams(data);
            currentStep.steps.push({
                type: step.op,
                parent: currentStep,
                gas: this.toNumberString(step.stack[0]),
                gasCost: this.numberToString(step.gasCost),
                from: step.from,
                to: this.decodeAddress(step.stack[1]),
                value: this.toNumberString(step.stack[2]),
                data,
                steps: [],
                logs: [],
                result: "0x",
                success: true,
                method,
                params
            });
            return currentStep.steps[currentStep.steps.length - 1];
        },
        CREATE(step, currentStep) {
            currentStep.steps.push({
                type: step.op,
                parent: currentStep,
                gasCost: this.numberToString(step.gasCost),
                from: step.from,
                value: this.toNumberString(step.stack[0]),
                data: step.sliceMemory(parseInt(step.stack[1]), parseInt(step.stack[2])),
                steps: [],
                logs: [],
                result: '0x',
                success: true
            });
            return currentStep.steps[currentStep.steps.length - 1];
        },
        CREATE2(step, currentStep) {
            currentStep.steps.push({
                type: step.op,
                parent: currentStep,
                gasCost: this.numberToString(step.gasCost),
                from: step.from,
                value: this.toNumberString(step.stack[0]),
                data: step.sliceMemory(parseInt(step.stack[1]), parseInt(step.stack[2])),
                salt: "0x" + step.stack[3],
                steps: [],
                logs: [],
                result: '0x',
                success: true
            });
            return currentStep.steps[currentStep.steps.length - 1];
        },
        LOG0(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: step.from,
                topics: [],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        LOG1(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: step.from,
                topics: [
                    step.stack[2]
                ],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        LOG2(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: step.from,
                topics: [
                    step.stack[2],
                    step.stack[3]
                ],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        LOG3(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: step.from,
                topics: [
                    step.stack[2],
                    step.stack[3],
                    step.stack[4]
                ],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        LOG4(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: step.from,
                topics: [
                    step.stack[2],
                    step.stack[3],
                    step.stack[4],
                    step.stack[5]
                ],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        STOP(step, currentStep, tx) {
            currentStep.terminated = true;
            var parent = currentStep.parent;
            delete currentStep.parent;
            return parent || tx;
        },
        INVALID(step, currentStep, tx) {
            currentStep.terminated = true;
            currentStep.success = false;
            currentStep.errorData = "INVALID";
            var parent = currentStep.parent;
            delete currentStep.parent;
            return parent || tx;
        },
        RETURN(step, currentStep, tx) {
            currentStep.terminated = true;
            currentStep.type !== 'CREATE' && currentStep.type !== 'CREATE2' && (currentStep.result = step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1])));
            try {
                (currentStep.type === 'CREATE' || currentStep.type === 'CREATE2') && globalStackTrace[step.i + 1] && (currentStep.to = this.decodeAddress(globalStackTrace[step.i + 1].stack[globalStackTrace[step.i + 1].stack.length - 1]));
            } catch (e) {}
            var parent = currentStep.parent;
            delete currentStep.parent;
            return parent || tx;
        },
        REVERT(step, currentStep, tx) {
            currentStep.terminated = true;
            currentStep.success = false;
            currentStep.errorData = step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]));
            var parent = currentStep.parent;
            delete currentStep.parent;
            return parent || tx;
        }
    },
    toHexString(subject) {
        return subject.indexOf && subject.indexOf('0x') === 0 ? subject : '0x' + subject.toString('hex');
    },
    toNumberString(subject) {
        return this.numberToString(parseInt(this.toHexString(subject)));
    },
    extractMethodAndParams(data) {
        return {
            method: '0x' + (data === '0x' ? '' : data.substring(2, 10)),
            params: '0x' + (data.length > 10 ? data.substring(10) : '')
        };
    },
    fillWithZeroes(x) {
        while(x.length < 64) {
            x = "0" + x;
        }
        return x;
    },
    decodeAddress(data) {
        try {
            return decodeAddressFunction.apply(this, arguments);
        } catch(e) {
        }
        var x = data.toString('hex').split('0x').join('');
        while(x.length > 40) {
            x = x.substring(1);
        }
        while(x.length < 40) {
            x = "0" + x;
        }
        return "0x" + x;
    },
    instrumentStep(step, currentStep) {
        try {
            return instrumentStepFunction.apply(this, arguments);
        } catch(e) {
        }
        var stack = [];
        for(var i = step.stack.length() - 1; i >= 0; i--) {
            stack.push("0x" + this.fillWithZeroes(step.stack.peek(i).toString('hex')));
        }
        return step = {
            ...step,
            op : step.op.toString(),
            from: currentStep.to,
            originalStack: step.stack,
            stack,
            originalMemory: step.memory,
            gasCost : step.getGas(),
            memory: step.memory,
            sliceMemory: (offset, length) => "0x" + (length === 0 ? '' : step.memory.slice(offset, offset + length).join(''))
        }
    },
    numberToString(num) {
        if (num === undefined || num === null) {
            num = 0;
        }
        if ((typeof num).toLowerCase() === 'string') {
            return num.split(',').join('');
        }
        let numStr = String(num);

        if (Math.abs(num) < 1.0) {
            let e = parseInt(num.toString().split('e-')[1]);
            if (e) {
                let negative = num < 0;
                if (negative) num *= -1
                num *= Math.pow(10, e - 1);
                numStr = '0.' + (new Array(e)).join('0') + num.toString().substring(2);
                if (negative) numStr = "-" + numStr;
            }
        } else {
            let e = parseInt(num.toString().split('+')[1]);
            if (e > 20) {
                e -= 20;
                num /= Math.pow(10, e);
                numStr = num.toString() + (new Array(e + 1)).join('0');
            }
        }
        return numStr;
    },
    init(transaction, stackTrace) {
        var data = transaction.input || transaction.data;
        this.currentStep = this.tx = {
            blockNumber: transaction.blockNumber,
            blockHash: transaction.blockHash,
            transactionHash: transaction.hash || transaction.transactionHash,
            type: transaction.contractAddress ? 'CREATE' : (data && data != '0x') ? 'CALL' : 'TRANSFER',
            gasLimit: this.numberToString(transaction.gas),
            gasPrice: this.numberToString(transaction.gasPrice),
            gas: this.numberToString(stackTrace.gas),
            from: transaction.from,
            to: transaction.to || transaction.contractAddress,
            data: transaction.contractAddress ? '0x' : data,
            value: this.numberToString(transaction.value),
            result: stackTrace.returnValue || '0x',
            success: true,
            steps: [],
            logs: []
        };
        var { method, params } = this.extractMethodAndParams(this.tx.data);
        this.tx.method = method;
        this.tx.params = params;
    },
    step(log) {
        if (!this.tx) {
            this.init({
                from: log.contract.getCaller(),
                to: log.contract.getAddress(),
                data: "0x" + log.contract.getInput().toString('hex'),
                value: this.numberToString(log.contract.getValue()),
                result: '0x',
                success: true,
                steps: [],
                logs: []
            }, {gas : '0'});
        }
        var lastTerminatedStep;
        try {
            lastTerminatedStep = this.currentStep.steps[this.currentStep.steps.length - 1];
            if(lastTerminatedStep && (lastTerminatedStep.type === 'CREATE' || lastTerminatedStep.type === 'CREATE2') && lastTerminatedStep.terminated && !lastTerminatedStep.to && log.stack) {
                try {
                    lastTerminatedStep.to = this.decodeAddress(log.stack.peek(log.stack.length() - 1));
                } catch(e) {}
            }
        } catch(e) {}
        this.callbacks[log.op.toString()] && (this.currentStep = this.callbacks[log.op.toString()].apply(this, [this.instrumentStep(log, this.currentStep), this.currentStep, this.tx]) || this.currentStep);
    },
    result(ctx) {
        this.tx.result = "0x" + ctx.output.join('');
        return this.tx;
    }
}