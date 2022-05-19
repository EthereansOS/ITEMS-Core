var blockchainConnection = require('./blockchainConnection');
var compile = require('./compile');

module.exports = async function test(funct, solidityVersion) {

    var functionText = funct.indexOf('function ') !== -1 ? funct : `function test() external {
            ${funct};
        }`
    var code = `
// SPDX-License-Identifier: MIT
pragma solidity ^${solidityVersion || global.solidityVersion};

contract Contract {

    ${functionText}
}`;
    var Contract = await compile(code, 'Contract', solidityVersion);
    var contract = await new web3.eth.Contract(Contract.abi).deploy({data: Contract.bin}).send(blockchainConnection.getSendingOptions());
    var functionName = Contract.abi.filter(it => it.type === 'function')[0].name;
    return await contract.methods[functionName]().call();
}