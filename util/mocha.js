global.blockchainConnection = require("./blockchainConnection");
global.assert = require("assert");
global.assert.equal = assert.strictEqual;
global.utilities = require("./utilities");
global.knowledgeBase = require("./knowledgeBase.json");
global.compile = require("./compile");
global.abi = new(require('ethers')).utils.AbiCoder();

global.catchCall = async function catchCall(funct, message, print) {
    var done = false;
    try {
        if(funct.send) {
            await funct.send(blockchainConnection.getSendingOptions());
        } else if(funct.then) {
            await funct;
        } else {
            var f = funct();
            f.then && await f();
        }
        done = true;
    } catch(e) {
        print && console.error(e);
        (!message || message.toLowerCase() === 'revert') && assert.strictEqual((e.message || e).indexOf('revert'), (e.message || e).length - ('revert'.length), e.message || e);
        message && message.toLowerCase() !== 'revert' && assert.notStrictEqual((e.message || e).toLowerCase().indexOf(message.toLowerCase()), -1, e.message || e);
    }
    assert(!done, "This shouldn't happen");
};

exports.mochaHooks = {
    beforeAll(done) {
        Promise.all([
            blockchainConnection.init
        ]).then(() => done()).catch(done);
    }
};