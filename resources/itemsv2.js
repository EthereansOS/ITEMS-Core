var compile = require("../util/compile");
var blockchainConnection = require("../util/blockchainConnection");
var utilities = require("../util/utilities");
var dynamicUriResolverAddress;
var itemProjectionFactory;
var itemProjectionFactoryHost;
var mainInterface;
var ItemInteroperableInterface;
var ItemProjection;

function convertHeader(header) {
    return Object.values(header);
}

async function convertItem(item) {
    return await item.map(async doc => doc != "Header" ? Object.values(doc) : await convertHeader(doc));
}

async function getMainInterface() {
    if (mainInterface) {
        return mainInterface;
    }

    await blockchainConnection.init;

    var ItemProjectionFactory = await compile('projection/factory/impl/ItemProjectionFactory');
    itemProjectionFactory = new web3.eth.Contract(ItemProjectionFactory.abi, knowledgeBase.itemProjectionFactoryAddress);
    itemProjectionFactoryHost = await itemProjectionFactory.methods.host().call();
    try {
        await blockchainConnection.unlockAccounts(itemProjectionFactoryHost);
    } catch (e) {}

    var ItemMainInterface = await compile('impl/ItemMainInterface');
    mainInterface = new web3.eth.Contract(ItemMainInterface.abi, await itemProjectionFactory.methods.mainInterface().call());

    dynamicUriResolverAddress = await mainInterface.methods.dynamicUriResolver().call();

    var NativeProjection = await compile("projection/native/NativeProjection");
    var nativeProjectionBytecode = new web3.eth.Contract(NativeProjection.abi).deploy({ data: NativeProjection.bin, arguments: ["0x"] }).encodeABI();

    ItemProjection = NativeProjection;//await compile("projection/IItemProjection");

    await itemProjectionFactory.methods.addModel(nativeProjectionBytecode).send(blockchainConnection.getSendingOptions({from : itemProjectionFactoryHost}));

    return mainInterface;
}

async function initialization(
    collectionId,
    header,
    item,
    host,
    plainUri,
    nativeProjectionAddress = utilities.voidEthereumAddress,
    bool = []
) {
    return await deployNativeCollection(host, item, bool, header);
    header = await convertHeader(header);

    await deploy(host, plainUri, nativeProjectionAddress);

    var deployParam = abi.encode(["bool[]"], [bool]);

    deployParam = abi.encode(
        [
            "bytes32",
            "tuple(address,string,string,string)",
            "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
            "bytes",
        ], [collectionId, header, item, deployParam]
    );

    deployParam = abi.encode(["address", "bytes"], [host, deployParam]);

    var transaction = await itemProjectionFactory.methods
        .deploy(deployParam)
        .send(blockchainConnection.getSendingOptions());

    var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash))
        .logs;
    var itemIds = logs
        .filter(
            (it) =>
            it.topics[0] ===
            web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
        )
        .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

    var native = new web3.eth.Contract(
        NativeProjection.abi,
        transaction.events.Deployed.returnValues.deployedAddress
    );

    if (itemIds.length > 0) {
        await Promise.all(
            itemIds.map(async(it, index) => {
                var checkBal = await checkBalances(item[index][3][0], it)
                await Promise.all(checkBal["balances"].map(async(bal, ind) => {
                    await Promise.all(bal.map((b, i) => {
                        assert.equal(b.sub(item[index][4][i]), '0')
                    }))
                }))
            })
        );
    }
    return {
        native,
        itemIds,
    };
}

function deployCollection(header, items, modelOrCode, data) {
    items = items || [];
    if (header.host == utilities.voidEthereumAddress && !data) {
        return mainInterface.methods.createCollection(header, items);
    }
    return {
        send(sendingOptions) {
            return new Promise(async function(ok, ko) {
                try {
                    var mintHost = header.host || header[0];
                    var deployer = await itemProjectionFactory.methods.deployer(mintHost).call();
                    if (deployer !== utilities.voidEthereumAddress) {
                        return ok(await mainInterface.methods.createCollection(header, items).send(sendingOptions));
                    }
                    data = data || web3.eth.abi.encodeParameters(["uint256[]", "address[]"], [
                        [1, 2, 3, 4, 5], [mintHost, mintHost, mintHost, mintHost, mintHost, mintHost]
                    ]);
                    var headerArray = Object.values(header);
                    var itemsArray = items.length === 0 || items[0] instanceof Array ? items : items.map(item => [Object.values(item.header), ...Object.values(item).slice(1)]);
                    var headerTuple = "tuple(address,string,string,string)";
                    var itemsTuple = `tuple(${headerTuple},bytes32,uint256,address[],uint256[])[]`;
                    data = abi.encode(["bytes32", headerTuple, itemsTuple, "bytes"], [utilities.voidBytes32, headerArray, itemsArray, data]);
                    data = web3.eth.abi.encodeParameters(["address", "bytes"], [!modelOrCode || modelOrCode === 0 ? utilities.voidEthereumAddress : mintHost, data]);
                    var transaction;
                    if (modelOrCode && typeof modelOrCode === "string" && modelOrCode.indexOf('0x') === 0) {
                        await catchCall(itemProjectionFactory.methods.deploySingleton(modelOrCode, data), "unauthorized");
                        transaction = await itemProjectionFactory.methods.deploySingleton(modelOrCode, data).send(blockchainConnection.getSendingOptions({ from: await itemProjectionFactory.methods.host().call() }));
                    } else {
                        data = web3.eth.abi.encodeParameters(["uint256", "bytes"], [modelOrCode || 0, data]);
                        transaction = await itemProjectionFactory.methods.deploy(data).send(sendingOptions);
                    }
                    transaction = {...transaction, events: transaction.events || {} };
                    var receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
                    var Collection = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3('Collection(address,address,bytes32)'))[0];
                    transaction.events.Collection = {
                        returnValues: {
                            from: web3.eth.abi.decodeParameter("address", Collection.topics[1]),
                            to: web3.eth.abi.decodeParameter("address", Collection.topics[2]),
                            collectionId: Collection.topics[3]
                        }
                    };
                    var CollectionItem = receipt.logs.filter(it => it.topics[0] === web3.utils.sha3('CollectionItem(bytes32,bytes32,uint256)'));
                    transaction.events.CollectionItem = CollectionItem.map(it => {
                        return {
                            returnValues: {
                                fromCollectionId: it.topics[1],
                                toCollectionId: it.topics[2],
                                itemId: web3.eth.abi.decodeParameter("uint256", it.topics[3])
                            }
                        }
                    });
                    transaction.events.CollectionItem = transaction.events.CollectionItem.length == 1 ? transaction.events.CollectionItem[0] : transaction.events.CollectionItem;
                    var deployedAddress = transaction.events.Deployed.returnValues.deployedAddress;
                    assert.notEqual(header.host, deployedAddress);
                    header.host = deployedAddress;
                    await blockchainConnection.unlockAccounts(header.host);
                    return ok(transaction);
                } catch (e) {
                    return ko(e);
                }
            })
        }
    }
}

function deployNativeCollection(host, itemsToMint, finalized, header) {
    return createCollection(host, itemsToMint, 1, finalized ? web3.eth.abi.encodeParameter("bool[]", finalized) : "0x", header);
}

async function createCollection(host, itemsToMint, modelOrCode, data, header) {
    mainInterface = await getMainInterface();
    var collection = header ? {...header} : {
        host,
        name: "Collection",
        symbol: "COL",
        uri: "uri",
    };
    collection[0] && (collection[0] = host);
    collection["0"] && (collection["0"] = host);
    collection.host && (collection.host = host);
    var items = !itemsToMint || itemsToMint.length === 0 ?
        [] :
        itemsToMint[0] instanceof Array ? itemsToMint :
        itemsToMint.map((it, i) => {
            return {
                header: {
                    host,
                    name: "Item_" + i,
                    symbol: "IT_" + i,
                    uri: "URI_" + i,
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: it.accounts || Object.keys(it),
                amounts: it.amounts || Object.values(it),
            };
        });
    var transaction = await deployCollection(collection, items, modelOrCode, data).send(blockchainConnection.getSendingOptions());
    var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash))
        .logs;
    var collectionId = web3.eth.abi.decodeParameter(
        "bytes32",
        logs.filter(
            (it) =>
            it.topics[0] === web3.utils.sha3("Collection(address,address,bytes32)")
        )[0].topics[3]
    );
    var itemIds = logs
        .filter(
            (it) =>
            it.topics[0] ===
            web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
        )
        .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));
    return {
        projection : new web3.eth.Contract(ItemProjection.abi, collection.host),
        native : new web3.eth.Contract(ItemProjection.abi, collection.host),
        collectionId,
        itemIds,
        projectionHost : host
    };
}

function asArray(item, asArray) {
    return !item ?
        [] :
        (item instanceof Array ? item : [item]).map((it) =>
            it instanceof Array ? it : asArray ? [it] : it
        );
}

async function asInteroperableInterface(itemId) {
    ItemInteroperableInterface = await compile("impl/ItemInteroperableInterface");
    var itemInteroperableInterface = new web3.eth.Contract(
        ItemInteroperableInterface.abi,
        await mainInterface.methods.interoperableOf(itemId).call()
    );
    try {
        await blockchainConnection.unlockAccounts(
            itemInteroperableInterface.options.address
        );
    } catch (e) {}
    return itemInteroperableInterface;
}

async function checkBalances(
    owners,
    itemIds,
    expectedBalances,
    expectedTotalSupplies,
    native
) {
    itemIds = asArray(itemIds, (owners = asArray(owners)).length > 1);
    if (owners.length === 0 || itemIds.length === 0) {
        throw new Error("owners and itemIds are empty");
    }
    expectedBalances = asArray(expectedBalances, owners.length > 1);
    expectedTotalSupplies = asArray(expectedTotalSupplies, owners.length > 1);
    var balances = [owners.map(() => "0")];
    var totalSupplies = [owners.map(() => "0")];
    var checkStep = async function checkStep(
        owner,
        itemIds,
        expectedBalances,
        expectedTotalSupplies
    ) {
        var b = itemIds.map(() => "0");
        var t = itemIds.map(() => "0");
        await Promise.all(
            itemIds.map(async(_, i) => {
                var itemId = itemIds[i];
                var mainTotalSupply = (t[i] = await mainInterface.methods
                    .totalSupply(itemId)
                    .call());
                var interoperableInterface = await asInteroperableInterface(itemId);
                var interoperableTotalSupply = await interoperableInterface.methods
                    .totalSupply()
                    .call();
                assert.equal(
                    mainTotalSupply,
                    interoperableTotalSupply,
                    `totalSupply mismatch for item #${itemId}`
                );

                if (native != null) {
                    var nativeTotalSupply = await native.methods.totalSupply(itemId).call();
                    assert.equal(
                        nativeTotalSupply,
                        mainTotalSupply,
                        `totalSupply mismatch between native and main interface for item #${itemId}`
                    );
                }

                expectedTotalSupplies &&
                    expectedTotalSupplies.length > 0 &&
                    assert.equal(
                        mainTotalSupply,
                        expectedTotalSupplies[i],
                        `expected totalSupply mismatch for item #${itemId}`
                    );

                var mainBalance = (b[i] = await mainInterface.methods
                    .balanceOf(owner, itemId)
                    .call());
                var interoperableBalance = await interoperableInterface.methods
                    .balanceOf(owner)
                    .call();

                assert.equal(
                    mainBalance,
                    interoperableBalance,
                    `balanceOf mismatch for owner ${owner} and item #${itemId}`
                );

                if (native != null) {
                    var nativeBalance = await native.methods.balanceOf(owner, itemId).call();
                    assert.equal(
                        mainBalance,
                        nativeBalance,
                        `balanceOf mismatch between native and main interface for owner ${owner} and item #${itemId}`
                    );
                }
                expectedBalances &&
                    expectedBalances.length > 0 &&
                    assert.equal(
                        mainBalance,
                        expectedBalances[i],
                        `expected balanceOf mismatch for owner ${owner} and item #${itemId}`
                    );
            })
        );

        var balanceOfBatch = await mainInterface.methods
            .balanceOfBatch(
                itemIds.map(() => owner),
                itemIds
            )
            .call();
        assert.equal(
            JSON.stringify(b),
            JSON.stringify(balanceOfBatch),
            `balanceOfBatch mismatch for owner ${owner}`
        );
        expectedBalances &&
            expectedBalances.length > 0 &&
            assert.equal(
                JSON.stringify(expectedBalances),
                JSON.stringify(b),
                `expected balanceOfBatch mismatch for owner ${owner}`
            );
        expectedBalances &&
            expectedBalances.length > 0 &&
            assert.equal(
                JSON.stringify(expectedBalances),
                JSON.stringify(balanceOfBatch),
                `expected balanceOfBatch mismatch for owner ${owner}`
            );
        return [b, t];
    };
    await Promise.all(
        owners.map(async(_, i) => {
            var step = await checkStep(
                owners[i],
                owners.length === 1 ? itemIds : itemIds[i],
                owners.length === 1 ? expectedBalances : expectedBalances[i],
                owners.length === 1 ? expectedTotalSupplies : expectedTotalSupplies[i]
            );
            balances[i] = step[0];
            totalSupplies[i] = step[1];
        })
    );
    return {
        balances,
        totalSupplies,
    };
}

async function createMintStruct(collections, itemids, host, account) {
    var val = [1e14, 1e15, 1e16, 1e17];

    const nums = new Set();
    const address = new Set();
    while (nums.size !== account) {
        nums.add((Math.floor(Math.random() * 10) + 1).mul(val[Math.floor(Math.random() * val.length)]));
    }
    while (address.size !== account) {
        address.add(accounts[Math.floor(Math.random() * 10)]);
    }

    return collections.map((collection, i) => {
        return {
            header: {
                host: host[i],
                name: "Item_" + i,
                symbol: "IT_" + i,
                uri: "URI_" + i,
            },
            collectionId: collection,
            id: itemids[i],
            accounts: Array.from(address),
            amounts: Array.from(nums),
        };
    });
}

module.exports = {
    initialization,
    createCollection,
    deployNativeCollection,
    checkBalances,
    convertHeader,
    convertItem,
    createMintStruct,
    getMainInterface
};