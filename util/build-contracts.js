var path = require('path');
module.exports = require('truffle-flattener-wrapper')(path.resolve(__dirname, '..', 'contracts'), path.resolve(__dirname, '..', 'flat')).catch(console.error);