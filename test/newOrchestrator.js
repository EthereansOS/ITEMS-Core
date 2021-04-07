var assert = require("assert");
var utilities = require("../util/utilities");
var context = require("../util/context.json");
var compile = require("../util/compile");
var blockchainConnection = require("../util/blockchainConnection");
var dfoManager = require("../util/dfo");
var dfoHubManager = require('../util/dfoHub');
var ethers = require('ethers');
var abi = new ethers.utils.AbiCoder();
var path = require('path');
var fs = require('fs');

describe("New Orchestrator", () => {

    var buyForETHAmount = 100;
    var Orchestrator;
    var Factory;
    var KnowledgeBase;
    var Native;
    var W20;
    var W1155;
    var W721;
    var InteroperableInterface;

    var native;
    var w20;
    var w1155;
    var w721;
    var interoperable;

    var uniswapV2Router;
    var uniswapV2Factory;
    var wethToken;

    var dfo;
    var knowledgeBase;
    var factory;
    var orchestrator;
    var erc20Wrapper;

    var ens;

    var tokens;

    before(async() => {
        await blockchainConnection.init;
        await dfoHubManager.init;
    });

    async function setup(prefix) {
        prefix = !prefix ? "" : prefix + "/";

        Orchestrator = await compile(prefix + "orchestrator/EthItemOrchestrator");
        W20 = await compile(prefix + "models/ERC20Wrapper/1/ERC20WrapperV1");
        KnowledgeBase = await compile(prefix + "knowledgeBase/KnowledgeBase");

        orchestrator = new web3.eth.Contract(Orchestrator.abi, context.ethItemOrchestratorAddress);

        var knowledgeBases = await orchestrator.methods.knowledgeBases().call();

        var knowledgeBase = new web3.eth.Contract(KnowledgeBase.abi, knowledgeBases[knowledgeBases.length - 1]);

        erc20Wrapper = new web3.eth.Contract(W20.abi, await knowledgeBase.methods.erc20Wrapper().call());

        await mintTokens();
        await wrap1155();

        var factories = await orchestrator.methods.factories().call();

        var args = [
            dfo.doubleProxyAddress,
            factories,
            knowledgeBases,
            utilities.voidEthereumAddress
        ];

        console.log(JSON.stringify(args))

        orchestrator = await new web3.eth.Contract(Orchestrator.abi).deploy({
            data: Orchestrator.bin,
            arguments: args
        }).send(blockchainConnection.getSendingOptions());

        console.log(orchestrator.options.address);

        var code = fs.readFileSync(path.resolve(__dirname, '..', 'resources/ChangeOrchestratorProposal.sol'), 'UTF-8').format(orchestrator.options.address, context.ethItemOrchestratorAddress);
        console.log(`\n\n${code}\n\n`);
        var proposal = await dfoHubManager.createProposal("item", "", true, code, "callOneTime(address)");
        await dfoHubManager.finalizeProposal(proposal);

        var knowledgeBases = await orchestrator.methods.knowledgeBases().call();

        knowledgeBase = new web3.eth.Contract(KnowledgeBase.abi, knowledgeBases[knowledgeBases.length - 1]);

        erc20Wrapper = new web3.eth.Contract(W20.abi, await knowledgeBase.methods.erc20Wrapper().call());

        console.log(factories, knowledgeBases, erc20Wrapper.options.address);
    }

    it("Creation", async() => {
        ens = new web3.eth.Contract(context.IERC721ABI, context.ensTokenAddress);

        dfo = dfoHubManager.dfos.item;
        uniswapV2Router = new web3.eth.Contract(context.uniswapV2RouterABI, context.uniswapV2RouterAddress);
        uniswapV2Factory = new web3.eth.Contract(context.uniswapV2FactoryABI, context.uniswapV2FactoryAddress);

        wethToken = new web3.eth.Contract(context.IERC20ABI, await uniswapV2Router.methods.WETH().call());

        tokens = [
            context.wethTokenAddress,
            context.buidlTokenAddress,
            context.usdtTokenAddress,
            context.usdcTokenAddress,
            context.daiTokenAddress,
            context.mkrTokenAddress
        ].map(it => new web3.eth.Contract(context.IERC20ABI, it));

        await Promise.all(tokens.map(it => buyForETH(it, buyForETHAmount)));

        await setup();
    });

    async function buyForETH(token, amount, from) {
        var value = utilities.toDecimals(amount.toString(), '18');
        if (token.options.address === context.wethTokenAddress) {
            return await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
                to: token.options.address,
                value,
                data: web3.utils.sha3("deposit()").substring(0, 10)
            }));
        }
        var path = [
            wethToken.options.address,
            token.options.address
        ];
        await uniswapV2Router.methods.swapExactETHForTokens("1", path, (from && (from.from || from)) || accounts[0], parseInt((new Date().getTime() / 1000) + 1000)).send(blockchainConnection.getSendingOptions({ from: (from && (from.from || from)) || accounts[0], value }));
    }

    async function tokenName(token) {
        try {
            return await token.methods.name().call();
        } catch (e) {}
        var raw = await web3.eth.call({
            to: token.options.address,
            data: web3.utils.sha3("name()").substring(0, 10)
        });
        return web3.utils.toUtf8(raw);
    }

    async function setERC20(oldOrchestrator) {
        var code = fs.readFileSync(path.resolve(__dirname, '..', 'resources/CreateERC20Proposal.sol'), 'UTF-8').format(orchestrator.options.address, oldOrchestrator || utilities.voidEthereumAddress);
        console.log(`\n\n${code}\n\n`);
        var proposal = await dfoManager.createProposal(dfo, "", true, code, "callOneTime(address)");
        await dfoManager.finalizeProposal(dfo, proposal);
        erc20Wrapper = new web3.eth.Contract(W20.abi, await knowledgeBase.methods.erc20Wrapper().call());
        console.log(erc20Wrapper.options.address);
    }

    async function mintTokens(amountPlain) {
        amountPlain = isNaN(amountPlain) ? 5 : amountPlain;
        for (var token of tokens) {
            try {
                console.log(await tokenName(token));
            } catch (e) {}
            var amount = utilities.toDecimals(amountPlain, await token.methods.decimals().call());
            await token.methods.approve(erc20Wrapper.options.address, amount).send(blockchainConnection.getSendingOptions());
            try {
                await erc20Wrapper.methods["mint(address,uint256)"](token.options.address, amount).send(blockchainConnection.getSendingOptions());
                var objectId = await erc20Wrapper.methods.object(token.options.address).call();
                console.log(await erc20Wrapper.methods.name(objectId).call(), await erc20Wrapper.methods.symbol(objectId).call());
                console.log(utilities.fromDecimals(await erc20Wrapper.methods.balanceOf(accounts[0], objectId).call(), 18), amountPlain.toString());
                assert(parseInt(await erc20Wrapper.methods.balanceOf(accounts[0], objectId).call()) >= parseInt(utilities.toDecimals(amountPlain.toString(), 18)));
            } catch (e) {
                token.options.address === "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" && console.error(e);
                assert.strictEqual(token.options.address, context.mkrTokenAddress);
                assert.notStrictEqual(e.message.indexOf('revert'), -1);
            }
        }
    }

    async function wrap1155() {
        var objectId = await erc20Wrapper.methods.object(context.buidlTokenAddress).call();
        var payload = "0x";
        payload = web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress);

        var transaction = await erc20Wrapper.methods.safeTransferFrom(accounts[0], orchestrator.options.address, objectId, utilities.toDecimals(1, 18), payload).send(blockchainConnection.getSendingOptions());
        var receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var log = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3("Mint(uint256,address,uint256)"))[0];
        var mintedObjectId = web3.eth.abi.decodeParameters(["uint256","address","uint256"], log.data)[0];
        var collection = new web3.eth.Contract(context.ethItemNativeABI, log.address);
        console.log(await collection.methods.asInteroperable(mintedObjectId).call(), await collection.methods.name(mintedObjectId).call(), await collection.methods.balanceOf(accounts[0], mintedObjectId).call());

        transaction = await erc20Wrapper.methods.safeTransferFrom(accounts[0], orchestrator.options.address, objectId, utilities.toDecimals(1, 18), payload).send(blockchainConnection.getSendingOptions());
        receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        log = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3("Mint(uint256,address,uint256)"))[0];
        mintedObjectId = web3.eth.abi.decodeParameters(["uint256","address","uint256"], log.data)[0];
        collection = new web3.eth.Contract(context.ethItemNativeABI, log.address);
        console.log(await collection.methods.asInteroperable(mintedObjectId).call(), await collection.methods.name(mintedObjectId).call(), await collection.methods.balanceOf(accounts[0], mintedObjectId).call());
    }

    async function createNative() {
        var data = web3.eth.abi.encodeParameters(["string","string","bool","string","address","bytes"], ["Gneppo","gnappo",true,"google.com",accounts[0],"0x"]).substring(2);
        var payload = web3.utils.sha3("init(string,string,bool,string,address,bytes)").substring(0, 10) + data;
        var method = orchestrator.methods.createNative(payload, "");
        //method = orchestrator.methods["createNative(address,bytes,string)"] ? orchestrator.methods.createNative(native.options.address, payload, "") : method;
        var transaction = await method.send(blockchainConnection.getSendingOptions());
        var receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var log = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3("NewNativeCreated(address,uint256,address,address)"))[0];
        var collectionAddress = web3.eth.abi.decodeParameter("address", log.topics[3]);
        var collection = new web3.eth.Contract(context.ethItemNativeABI, collectionAddress);
        console.log(await collection.methods.name().call(), await collection.methods.symbol().call());
    }

    async function bootWalker(walkerObject) {
        var walker = new ethers.Wallet(process.env.walker);
        await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            to: walker.address,
            value: utilities.toDecimals(5, 18)
        }));
        await web3.eth.sendSignedTransaction(await walker.signTransaction(blockchainConnection.getSendingOptions({
            nonce: await web3.eth.getTransactionCount(walker.address),
            from: walker.address,
            to: ens.options.address,
            data: ens.methods.safeTransferFrom(walker.address, accounts[0], walkerObject, "0x").encodeABI()
        })));
    }

    async function wrap721() {
        var objectId = "99189217475543222379800412212816158939019665998179801856537104211515593160127";
        await bootWalker(objectId);
        var payload = "0x";
        payload = web3.eth.abi.encodeParameter("address", utilities.voidEthereumAddress);
        var transaction = await ens.methods.safeTransferFrom(accounts[0], orchestrator.options.address, objectId, payload).send(blockchainConnection.getSendingOptions());
        var receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var log = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3("Mint(uint256,address,uint256)"))[0];
        var mintedObjectId = web3.eth.abi.decodeParameters(["uint256","address","uint256"], log.data)[0];
        var collection = new web3.eth.Contract(context.ethItemNativeABI, log.address);
        console.log(await collection.methods.name(mintedObjectId).call(), await collection.methods.balanceOf(accounts[0], mintedObjectId).call());
    }

    it("NEW - Mint Tokens", () => mintTokens());
    it("NEW - WRAP 1155", wrap1155);
    it("NEW - Create Native", createNative);
    /*it("NEW - 721", wrap721);*/
});