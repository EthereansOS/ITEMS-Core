var blockchainCall = require('./blockchainCall');

module.exports = function deployContract(contract, bin, args, additionalParams) {
    return blockchainCall(contract.deploy.bind(contract), {data : bin, arguments : args || []}, additionalParams);
};