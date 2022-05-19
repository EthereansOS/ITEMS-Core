var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");

var mainInterface;

describe("Item V2 Projections - Native", () => {
    before(async() => {
        mainInterface = await itemsv2.getMainInterface();
    });

    it("#620 Change Collection Metadata", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * setHeader(Header calldata value)
         *
         * Change the Metadata of the Collection (not the host)
         * must fail: cannot change the header from an unauthorized account
         */
        var collectionId = utilities.voidBytes32;

        var nativeHost = accounts[1];

        var collectionHeader = {
            host: nativeHost,
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId], [0], [utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var native = (
            await itemsv2.initialization(
                collectionId,
                collectionHeader,
                items,
                nativeHost,
                "URI"
            )
        )["native"];

        console.log("Native", native.options.address);
        await itemProjection.assertDecimals(
            native.methods.decimals().call(),
            "18"
        );

        assert.equal(nativeHost, await native.methods.host().call());

        var expectedCollection = {
            host: native.options.address,
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        await itemProjection.assertCheckHeader(
            expectedCollection,
            mainInterface.methods
            .collection(await native.methods.collectionId().call())
            .call()
        );

        var newCollectionHeader = {
            host: utilities.voidEthereumAddress,
            name: "Collection2",
            symbol: "COL2",
            uri: "uri2",
        };

        await catchCall(
            native.methods
            .setHeader(newCollectionHeader)
            .send(blockchainConnection.getSendingOptions({ from: accounts[2] })),
            "Unauthorized"
        );

        await native.methods
            .setHeader(newCollectionHeader)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        var expectedNewCollection = {
            host: native.options.address,
            name: "Collection2",
            symbol: "COL2",
            uri: "uri2",
        };

        await itemProjection.assertCheckHeader(
            expectedNewCollection,
            mainInterface.methods
            .collection(await native.methods.collectionId().call())
            .call()
        );

        await itemProjection.assertEqualHeaderUri(
            native.methods.uri().call(),
            "uri2"
        );
    });

    it("#621 Change Collection host", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * setHeader(Header calldata value)
         *
         * Change the Metadata of the host of the Collection.
         * Changing the host means that the Projection address is no longer the host address and so it can't manage anymore the Collection.
         * must fail: cannot change the header from an unauthorized account
         */
        var collectionId = utilities.voidBytes32;

        var nativeHost = accounts[1];

        var collectionHeader = {
            host: nativeHost,
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId], [0], [utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            nativeHost,
            "URI"
        );

        var native = res["native"];
        var itemIds = res["itemIds"];

        console.log("Native", native.options.address);

        await itemProjection.assertDecimals(
            native.methods.decimals().call(),
            "18"
        );

        assert.equal(nativeHost, await native.methods.host().call());

        var expectedCollection = {
            host: native.options.address,
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };
        await itemProjection.assertCheckHeader(
            expectedCollection,
            mainInterface.methods
            .collection(await native.methods.collectionId().call())
            .call()
        );

        var newCollectionHeader = {
            host: accounts[2],
            name: "Collection2",
            symbol: "COL2",
            uri: "uri2",
        };

        await catchCall(
            native.methods
            .setHeader(newCollectionHeader)
            .send(blockchainConnection.getSendingOptions({ from: accounts[2] })),
            "Unauthorized"
        );

        await native.methods
            .setHeader(newCollectionHeader)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await catchCall(
            native.methods
            .setHeader(newCollectionHeader)
            .send(blockchainConnection.getSendingOptions({ from: accounts[2] })),
            "Unauthorized"
        );

        var expectedNewCollection = {
            host: native.options.address,
            name: "Collection2",
            symbol: "COL2",
            uri: "uri2",
        };

        await itemProjection.assertCheckHeader(
            expectedNewCollection,
            mainInterface.methods
            .collection(await native.methods.collectionId().call())
            .call()
        );
        collectionData = await mainInterface.methods
            .collection(await native.methods.collectionId().call())
            .call();

        await itemProjection.assertEqualHeaderHost(
            collectionData.host,
            native.options.address
        );

        await itemProjection.assertEqualHeaderUri(
            native.methods.uri().call(),
            expectedNewCollection.uri
        );

        var CreateItem = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [itemIds[0]], [accounts[1]], 3);

        await catchCall(mainInterface.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[2] })), "Unauthorized");
    });

    it("#623 Change the Metadata of Items", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values)
         *
         * Change the Metadata of the Collection Items (not host).
         * must fail: an address different from the host can't change the Items Metadata
         */
        var collectionId = utilities.voidBytes32;

        var nativeHost = accounts[1];

        var collectionHeader = {
            host: nativeHost,
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId], [0], [utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            nativeHost,
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var expectedCollection = {
            host: native.options.address,
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        await itemProjection.assertCheckHeader(
            expectedCollection,
            mainInterface.methods
            .collection(await native.methods.collectionId().call())
            .call()
        );

        assert.equal(nativeHost, await native.methods.host().call());

        var newItemHeader = {
            host: native.options.address,
            name: "Item2",
            symbol: "I2",
            uri: "uri2",
        };

        await catchCall(
            native.methods
            .setItemsMetadata(itemIds, [newItemHeader])
            .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
            "unauthorized"
        );

        await native.methods
            .setItemsMetadata(itemIds, [newItemHeader])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        var ExpectedResult = {
            header: {
                host: utilities.voidEthereumAddress,
                name: "Item2",
                symbol: "I2",
                uri: "uri2",
            },
            collectionId: await native.methods.collectionId().call(),
            id: itemIds[0],
            accounts: [accounts[1]],
            amounts: [10000],
        };

        await itemProjection.checkItem(
            ExpectedResult,
            await mainInterface.methods.item(itemIds[0]).call()
        );
    });

    it("#624 Impossible to Change the host of Items", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values)
         *
         * Change the host of Items.
         * This operation cannot be performed because the host of an Item is ever equal to void address.
         * must fail: cannot change the header from an unauthorized account
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId], [0], [utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];
        var expectedCollection = {
            host: native.options.address,
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };
        await itemProjection.assertCheckHeader(
            expectedCollection,
            mainInterface.methods
            .collection(await native.methods.collectionId().call())
            .call()
        );

        var ItemHeader = {
            host: accounts[9],
            name: "Item2",
            symbol: "I2",
            uri: "uri2",
        };

        await catchCall(
            native.methods
            .setItemsMetadata(itemIds, [collectionHeader])
            .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
            "Unauthorized"
        );

        await native.methods
            .setItemsMetadata(itemIds, [ItemHeader])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await catchCall(
            native.methods
            .setItemsMetadata(itemIds, [collectionHeader])
            .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
            "Unauthorized"
        );
        var ExpectedResult = {
            header: {
                host: utilities.voidEthereumAddress,
                name: "Item2",
                symbol: "I2",
                uri: "uri2",
            },
            collectionId: await native.methods.collectionId().call(),
            id: itemIds[0],
            accounts: items[0][3],
            amounts: items[0][4],
        };

        await itemProjection.checkItem(
            ExpectedResult,
            await mainInterface.methods.item(itemIds[0]).call()
        );
    });

    it("#625 Impossible to Change the Collection of Items", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * setItemsCollection(uint256[] calldata itemIds, bytes32[] calldata collectionIds)
         *
         * Change the Collection of Items.
         * Changing the Collection id, the Items can be no longer managed by the Projection
         * must fail: an address different from the host can't change the Items Collection
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId, collectionId], [0, 0], [utilities.voidEthereumAddress, utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var itemsCollection2 = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var expectedCollection = {
            host: native.options.address,
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };
        await itemProjection.assertCheckHeader(
            expectedCollection,
            mainInterface.methods
            .collection(await native.methods.collectionId().call())
            .call()
        );

        var collectionHeader2 = {
            host: accounts[1],
            name: "Collection2",
            symbol: "COL2",
            uri: "uri2",
        };
        var resCollection2 = await itemsv2.initialization(
            collectionId,
            collectionHeader2,
            itemsCollection2,
            accounts[1],
            "URI"
        );
        var nativeCollection2 = resCollection2["native"];

        var collection2Id = await nativeCollection2.methods.collectionId().call();

        await catchCall(
            native.methods
            .setItemsCollection(itemIds, [collection2Id, collection2Id])
            .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
            "unauthorized"
        );

        await catchCall(
            native.methods
            .setItemsCollection(itemIds, [collection2Id, collection2Id])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Impossibru"
        );

        await itemProjection.assertCheckCollection(items, collection2Id);
    });

    it("#627 Create Items", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items)
         *
         * Create new Items for different accounts and amounts calling the Native Projection mintItems functions.
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = [accounts[1], "Collection1", "COL1", "uri1"];

        var items = [];

        var res = await itemsv2.deployNativeCollection(
            accounts[1],
            items
        );
        var native = res["projection"];

        var CreateItem = await itemsv2.createMintStruct([utilities.voidBytes32], [0], [accounts[1]], 2);

        await catchCall(
            native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[6] })),
            "Unauthorized"
        );

        var transaction = await itemProjection.assertCheckBalanceSupply(
            native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            CreateItem,
            native
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[6] })),
            "Unauthorized"
        );

        var itemIds = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs.filter(it => it.topics[0] === web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")).map(it => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        assert(itemIds.length > 0);

        for (var itemId of itemIds) {
            var item = await mainInterface.methods.item(itemId).call();
            assert.equal(utilities.voidEthereumAddress, item.header.host);
        }
    });

    it("#628 Mint Items", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items)
         *
         * Mint previously created Items for different accounts and amounts calling the Native Projection mintItems functions.
         * must fail: cannot mint items from unauthorized address
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId, collectionId], [0, 0], [utilities.voidEthereumAddress, utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var CreateItem = await itemsv2.createMintStruct([await native.methods.collectionId().call(), utilities.voidBytes32], [itemIds[0], itemIds[1]], [accounts[1], accounts[1]], 3);

        var checkBal = await Promise.all(
            CreateItem.map(async(it, i) => {
                return await itemsv2.checkBalances(
                    it.accounts,
                    Array(it.accounts.length).fill(itemIds[i])
                );
            })
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[8] })),
            "Unauthorized"
        );

        await native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds, native);

        for (var itemId of itemIds) {
            console.log("Checking ItemID Header", itemId);
            var item = await mainInterface.methods.item(itemId).call();
            assert.equal(utilities.voidEthereumAddress, item.header.host);
        }
    });

    it("#630 Create Items for Collection ids and Items ids that don't exist", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items)
         *
         * Create new Items for different accounts and amounts calling the Native Projection mintItems functions using wrong Collection ids and Item
         *ids
         * Using non-existent means that the Items cannot be created
         * must fail: I cannot create items from a non-existing collection/id
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];

        var CreateItem = await itemsv2.createMintStruct([web3.utils.sha3("lalelakelkl")], [697231], [accounts[1]], 1);

        await catchCall(
            native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Unauthorized"
        );
    });

    it("#631 Create and mint Items with Collection ids and Items ids not controlled by the Projection", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items)
         *
         * Mint new Items for different accounts and amounts calling the Native Projection mintItems functions using other Collection ids and Item
         *ids
         * Using a Collection id different from the one controlled by the Projection and Items ids belonging to that Collection means that the Items cannot be minted
         * must fail: cannot mint items with Collection ids and Items ids not controlled by the Projection
         */
        var collectionId = utilities.voidBytes32;

        var headerCollection = {
            host: accounts[1],
            name: "Colection1",
            symbol: "C1",
            uri: "uriC1",
        };

        var item = (await itemsv2.createMintStruct([collectionId], [0], [utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res1 = await itemsv2.initialization(
            collectionId,
            headerCollection,
            item,
            accounts[1],
            "URI"
        );
        var native1 = res1["native"];
        var collectionIdMain = res1.collectionId;
        var itemIds1 = res1["itemIds"][0];

        var collectionHeader = [accounts[9], "Collection1", "COL1", "uri1"];

        var items = [
            [
                [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
                await native1.methods.collectionId().call(),
                itemIds1, [accounts[1]],
                [10000],
            ],
        ];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[9],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"][0];

        assert.notEqual(itemIds, itemIds1);
        assert.notEqual(await native.methods.collectionId().call(), collectionIdMain);

        var CreateItem = await itemsv2.createMintStruct([collectionIdMain], [itemIds1], [accounts[1]], 1);

        await catchCall(
            native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Unauthorized"
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
            "Unauthorized"
        );

        var CreateNativeItem = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [itemIds], [accounts[1]], 1);

        var checkBal = await Promise.all(
            CreateNativeItem.map(async(it, i) => {
                return await itemsv2.checkBalances(
                    it.accounts,
                    Array(it.accounts.length).fill(itemIds)
                );
            })
        );

        await catchCall(
            native.methods
            .mintItems(CreateNativeItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Unauthorized"
        );

        await native.methods
            .mintItems(CreateNativeItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[9] }));

        await itemProjection.assertCheckBalance(
            checkBal,
            CreateNativeItem,
            itemIds,
            native
        );
    });

    it("#632 Create and mint Items without passing the Header", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items)
         *
         * Create and Mint new Items for different accounts and amounts calling the Native Projection mintItems functions without passing the Header.
         * The data are automatically taken from the Collection Header.
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [
            [
                [utilities.voidEthereumAddress, "", "", ""],
                collectionId,
                0, [accounts[1]],
                [10000],
            ],
        ];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"][0];

        var ExpectedResult = {
            header: {
                host: utilities.voidEthereumAddress,
                name: "Collection1",
                symbol: "COL1",
                uri: "uri1",
            },
            collectionId: await native.methods.collectionId().call(),
            id: itemIds,
            accounts: [accounts[1]],
            amounts: ["10000000000000000"],
        };

        await itemProjection.checkItem(
            ExpectedResult,
            await mainInterface.methods.item(itemIds).call()
        );

        var CreateItem = [{
            header: {
                host: utilities.voidEthereumAddress,
                name: "asfasdf",
                symbol: "fsdfsdf",
                uri: "dfsdffsf",
            },
            collectionId: await native.methods.collectionId().call(),
            id: itemIds,
            accounts: [accounts[1]],
            amounts: ["10000000000000000"],
        }, ];

        var checkBal = await Promise.all(
            CreateItem.map(async(it, i) => {
                return await itemsv2.checkBalances(
                    it.accounts,
                    Array(it.accounts.length).fill(itemIds)
                );
            })
        );

        await native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds, native);

        await itemProjection.checkItem(
            ExpectedResult,
            await mainInterface.methods.item(itemIds).call()
        );
    });


    it("#632/2 Create Items without passing the Header", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items)
         *
         * Create and Mint new Items for different accounts and amounts calling the Native Projection mintItems functions without passing the Header.
         * The data are automatically taken from the Collection Header.
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];

        var CreateItem = [{
            header: {
                host: utilities.voidEthereumAddress,
                name: "",
                symbol: "",
                uri: "",
            },
            collectionId: await native.methods.collectionId().call(),
            id: 0,
            accounts: [accounts[1]],
            amounts: ["10000000000000000"],
        }, ];

        var tx = await itemProjection.assertCheckBalanceSupply(
            native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            CreateItem,
            native
        );

        var itemIds = await itemProjection.getItemIdFromLog(tx);

        var ExpectedResult = {
            header: {
                host: utilities.voidEthereumAddress,
                name: "Collection1",
                symbol: "COL1",
                uri: "uri1",
            },
            collectionId: await native.methods.collectionId().call(),
            id: itemIds[0],
            accounts: [accounts[1]],
            amounts: ["10000000000000000"],
        };

        await itemProjection.checkItem(
            ExpectedResult,
            await mainInterface.methods.item(itemIds[0]).call()
        );
    });

    it("#633 Create and mint Items passing a host address different from void address", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items)
         *
         * Create and mint new Items for different accounts and amounts calling the Native Projection mintItems functions passing an Item host
         * The Item host set is not a valid parameter.
         * The host is automatically set as void address.
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId], [0], [accounts[1]], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"][0];

        var CreateItem = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [itemIds], [accounts[4]], 1);

        var checkBal = await Promise.all(
            CreateItem.map(async(it, i) => {
                return await itemsv2.checkBalances(
                    it.accounts,
                    Array(it.accounts.length).fill(itemIds)
                );
            })
        );

        await native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        await itemProjection.assertCheckBalance(checkBal, CreateItem, itemIds, native);

        var ExpectedResult = {
            header: {
                host: utilities.voidEthereumAddress,
                name: "Item_0",
                symbol: "IT_0",
                uri: "URI_0",
            },
            collectionId: await native.methods.collectionId().call(),
            id: itemIds,
            accounts: CreateItem[0]["accounts"],
            amounts: CreateItem[0]["amounts"],
        };

        await itemProjection.checkItem(
            ExpectedResult,
            await mainInterface.methods.item(itemIds).call()
        );
    });

    it("#633/2 Create and mint Items passing a host address different from void address", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items)
         *
         * Create and mint new Items for different accounts and amounts calling the Native Projection mintItems functions passing an Item host
         * The Item host set is not a valid parameter.
         * The host is automatically set as void address.
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];

        var CreateItem = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [0], [accounts[4]], 1);

        var tx = await itemProjection.assertCheckBalanceSupply(
            native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            CreateItem,
            native
        );

        var itemIds = await itemProjection.getItemIdFromLog(tx);

        var ExpectedResult = {
            header: {
                host: utilities.voidEthereumAddress,
                name: "Item_0",
                symbol: "IT_0",
                uri: "URI_0",
            },
            collectionId: await native.methods.collectionId().call(),
            id: itemIds[0],
            accounts: CreateItem[0]["accounts"],
            amounts: CreateItem[0]["amounts"],
        };

        await itemProjection.checkItem(
            ExpectedResult,
            await mainInterface.methods.item(itemIds[0]).call()
        );

        CreateItem.forEach((it, i) => it.id = itemIds[i]);

        await native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await itemProjection.checkItem(
            ExpectedResult,
            await mainInterface.methods.item(itemIds[0]).call()
        );
    });

    it("#635 Create and mint items with finalized as true", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items, bool[] memory finalized)
         *
         * Create and then mint new Items for different accounts and amounts calling the Native Projection mintItems functions passing finalized as true.
         * In this case the Items cannot be minted anymore.
         * must fail: cannot mint finalized item
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];

        var CreateItem = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [0], [accounts[1]], 1);

        var tx = await itemProjection.assertCheckBalanceSupply(
            native.methods
            .mintItems(CreateItem, [false])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            CreateItem,
            native
        );

        idItems = await itemProjection.getItemIdFromLog(tx);

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(idItems[0]).call(),
            false
        );

        var CreateItem2 = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [idItems[0]], [accounts[1]], 1);

        await native.methods
            .mintItems(CreateItem2, [true])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(idItems[0]).call(),
            true
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem2)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );
    });

    it("#636 Create and mint Items with finalized as false", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items, bool[] memory finalized)
         *
         * Mint new Items for different accounts and amounts calling the Native Projection mintItems functions passing finalized as false.
         * In this case the Items can be minted afterwards.
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId], [0], [accounts[1]], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var CreateItem1 = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [itemIds[0]], [accounts[1]], 1);

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemIds[0]).call(),
            false
        );

        await native.methods.finalize(itemIds).send(blockchainConnection.getSendingOptions({ from: accounts[1] }))

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemIds[0]).call(),
            true
        );

        await catchCall(native.methods
            .mintItems(CreateItem1)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "finalized")

        var CreateItem = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [0], [accounts[1]], 1);

        var tx = await itemProjection.assertCheckBalanceSupply(
            native.methods
            .mintItems(CreateItem, [false])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            CreateItem,
            native
        );

        idItems = await itemProjection.getItemIdFromLog(tx);

        await native.methods.finalize(idItems).send(blockchainConnection.getSendingOptions({ from: accounts[1] }))

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(idItems[0]).call(),
            true
        );

        var MintItem = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [idItems[0]], [accounts[1]], 1);

        await catchCall(
            native.methods
            .mintItems(MintItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "finalized");

        await catchCall(
            native.methods
            .mintItems(MintItem, [true])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "finalized");

        await catchCall(
            native.methods
            .mintItems(MintItem, [false])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "finalized");
    });

    it("#640 Mint previously created items passing finalized as true", async() => {
        /**
         * Authorized subjects:
         * Collection host address
         * Functions used in the test:
         * lazyInit
         * mintItems (CreateItem[] calldata items, bool[] memory finalized)
         *
         * Create Items when initializing the Native Projection
         * Mint Items calling the Native Projection mintItems functions passing finalized as true.
         * In this case the Items can be minted.
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId, collectionId, collectionId], [0, 0, 0], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI",
            utilities.voidEthereumAddress, [true, false]
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var CreateItem1 = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [itemIds[0]], [accounts[1]], 1);

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemIds[0]).call(),
            true
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem1)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem1, [true])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem1, [false])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

        var CreateItem2 = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [itemIds[1]], [accounts[1]], 1);

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemIds[1]).call(),
            false
        );

        await native.methods
            .mintItems(CreateItem2, [true])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemIds[1]).call(),
            true
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem2, [true])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem2, [false])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem2)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemIds[2]).call(),
            false
        );

        await native.methods.finalize([itemIds[2]]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }))

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemIds[2]).call(),
            true
        );

        var CreateItem3 = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [itemIds[2]], [accounts[1]], 1);

        await catchCall(
            native.methods
            .mintItems(CreateItem3, [false])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem3, [true])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem3)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );


        var CreateItem4 = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [0], [accounts[1]], 1);

        var tx = await itemProjection.assertCheckBalanceSupply(
            native.methods
            .mintItems(CreateItem4, [true])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            CreateItem4,
            native
        );

        var itemId4 = await itemProjection.getItemIdFromLog(tx);

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemId4[0]).call(),
            true
        );

        CreateItem4 = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [itemId4[0]], [accounts[1]], 1);

        await catchCall(
            native.methods
            .mintItems(CreateItem4)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

        var CreateItem5 = await itemsv2.createMintStruct([await native.methods.collectionId().call()], [0], [accounts[1]], 1);

        var tx = await native.methods
            .mintItems(CreateItem5, [false])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        var itemId5 = await itemProjection.getItemIdFromLog(tx);

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemId5[0]).call(),
            false
        );

        CreateItem5 = await itemsv2.createMintStruct([await native.methods.collectionId().call(), await native.methods.collectionId().call()], [itemId5[0], itemId5[0]], [accounts[1], accounts[1]], 1);

        await native.methods
            .mintItems(CreateItem5, [true, false])
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await itemProjection.assertCheckFinalized(
            native.methods.isFinalized(itemId5[0]).call(),
            true
        );

        await catchCall(
            native.methods
            .mintItems(CreateItem5)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
            "Finalized"
        );

    });

    it("#637 Items operation: safeTransferFrom", async() => {
        /**
         * Authorized subjects:
         * Item holders
         * approved operators addresses
         * Functions used in the test:
         * lazyInit
         * safeTransferFrom
         *
         * Create Items when initializing the Native Projection
         * The Items holders perform a safeTransferFrom using the Native projection method
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId, collectionId], [0, 0], [utilities.voidEthereumAddress, utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var transferAmount = [items[0][4][0], items[1][4][0]];
        var fromAddress = [items[0][3][0], items[1][3][0]];
        var toAddress = [accounts[3], accounts[4]];
        var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemIds);

        var checkBalTo = await itemsv2.checkBalances(toAddress, itemIds);

        await catchCall(
            native.methods
            .safeTransferFrom(
                utilities.voidEthereumAddress,
                accounts[5],
                itemIds[0],
                '100000000',
                "0x",
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
            "required from");

        await catchCall(
            native.methods
            .safeTransferFrom(
                utilities.voidEthereumAddress,
                utilities.voidEthereumAddress,
                itemIds[0],
                '100000000',
                "0x",
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
            "required from");

        await catchCall(
            native.methods
            .safeTransferFrom(
                fromAddress[0],
                utilities.voidEthereumAddress,
                itemIds[0],
                '100000000',
                "0x",
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
            "required to");

        await Promise.all(
            itemIds.map(async(item, index) => {
                await native.methods
                    .safeTransferFrom(
                        fromAddress[index],
                        toAddress[index],
                        item,
                        transferAmount[index],
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: fromAddress[index],
                        })
                    );
            })
        );

        await itemProjection.assertTransferBalance(
            fromAddress,
            toAddress,
            itemIds,
            transferAmount,
            checkBalFrom,
            checkBalTo,
            native
        );
    });

    it("#641 Items operation: SafeTransferFrom and approved operators", async() => {
        /**
         * Authorized subjects:
         * Item holders
         * approved operators addresses
         * Functions used in the test:
         * lazyInit
         * setApprovalForAll
         * safeTransferFrom
         *
         * Create Items when initializing the Native Projection
         * The Items holders approve operators to act on their Items using the setApprovalForAll (Main Interface)
         * The operators perform a safeBatchTransferFrom using the Native projection method transferring multiple Items at once
         * must fail: cannot call setApprovalForAll from nativeProjection
         * must fail: cannot call safeTransferFrom from unauthorized address
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = (await itemsv2.createMintStruct([collectionId, collectionId], [0, 0], [utilities.voidEthereumAddress, utilities.voidEthereumAddress], 1)).map(it => [Object.values(it.header), ...Object.entries(it).filter(it => it[0] !== 'header').map(it => it[1])]);

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var transferAmount = [items[0][4][0], items[1][4][0]];
        var fromAddress = [items[0][3][0], items[1][3][0]];
        var toAddress = [accounts[3], accounts[4]];
        var operator = [accounts[7], accounts[8]];

        await Promise.all(
            operator.map(async(op, index) => {
                await itemProjection.assertCheckIsApprovedForAll(
                    native.methods.isApprovedForAll(fromAddress[index], op).call(),
                    false
                );
                await native.methods
                    .setApprovalForAll(op, true)
                    .send(
                        blockchainConnection.getSendingOptions({ from: fromAddress[index] })
                    );
                await itemProjection.assertCheckIsApprovedForAll(
                    native.methods.isApprovedForAll(fromAddress[index], op).call(),
                    true
                );
            })
        );

        var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemIds);

        var checkBalTo = await itemsv2.checkBalances(toAddress, itemIds);

        await Promise.all(
            itemIds.map((item, index) => catchCall(
                native.methods
                .safeTransferFrom(
                    fromAddress[index],
                    toAddress[index],
                    item,
                    transferAmount[index],
                    "0x"
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[9],
                    })
                ),
                "amount exceeds allowance"
            ))
        );

        await Promise.all(
            itemIds.map(async(item, index) => {
                await native.methods
                    .safeTransferFrom(
                        fromAddress[index],
                        toAddress[index],
                        item,
                        transferAmount[index],
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: operator[index],
                        })
                    );
            })
        );

        await itemProjection.assertTransferBalance(
            fromAddress,
            toAddress,
            itemIds,
            transferAmount,
            checkBalFrom,
            checkBalTo,
            native
        );
    });

    it("#642 Items operation: SafeBatchTransferFrom", async() => {
        /**
         * Authorized subjects:
         * Item holders
         * approved operators addresses
         * Functions used in the test:
         * lazyInit
         * safeBatchTransferFrom
         *
         * Create Items when initializing the Native Projection
         * The Items holders perform a safeBatchTransferFrom using the Native projection method transferring multiple Items at once
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [
            [
                [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
                collectionId,
                0, [accounts[1]],
                ["60000000000000000"],
            ],
            [
                [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
                collectionId,
                0, [accounts[1]],
                ["30000000000000000"],
            ],
            [
                [utilities.voidEthereumAddress, "Item3", "I3", "uriItem3"],
                collectionId,
                0, [accounts[2]],
                ["40000000000000000"],
            ],
            [
                [utilities.voidEthereumAddress, "Item4", "I4", "uriItem4"],
                collectionId,
                0, [accounts[2]],
                ["20000000000000000"],
            ],
        ];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var transferAmount = [
            "10000000000000000",
            "2500000000000000",
            "20000000000000000",
            "1000000000000000",
        ];
        var fromAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
        var toAddress = [accounts[3], accounts[3], accounts[4], accounts[4]];
        var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemIds);

        var checkBalTo = await itemsv2.checkBalances(toAddress, itemIds);

        var items1 = itemIds.slice(0, 2);
        var items2 = itemIds.slice(2, 4);

        await catchCall(native.methods
            .safeBatchTransferFrom(
                utilities.voidEthereumAddress,
                accounts[9],
                items1,
                transferAmount.slice(0, 2),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "required from");

        await catchCall(native.methods
            .safeBatchTransferFrom(
                fromAddress[0],
                utilities.voidEthereumAddress,
                items1,
                transferAmount.slice(0, 2),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "required to");

        await catchCall(native.methods
            .safeBatchTransferFrom(
                utilities.voidEthereumAddress,
                utilities.voidEthereumAddress,
                items1,
                transferAmount.slice(0, 2),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "required from");

        await native.methods
            .safeBatchTransferFrom(
                fromAddress[0],
                toAddress[0],
                items1,
                transferAmount.slice(0, 2),
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: fromAddress[0],
                })
            );

        await native.methods
            .safeBatchTransferFrom(
                fromAddress[2],
                toAddress[2],
                items2,
                transferAmount.slice(2, 4),
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: fromAddress[2],
                })
            );

        await itemProjection.assertTransferBalance(
            fromAddress,
            toAddress,
            itemIds,
            transferAmount,
            checkBalFrom,
            checkBalTo,
            native
        );
    });

    it("#643 Items operation: safeBatchTransferFrom and approved operators", async() => {
        /**
         * Authorized subjects:
         * Item holders
         * approved operators addresses
         * Functions used in the test:
         * lazyInit
         * safeBatchTransferFrom
         * setApprovalForAll
         *
         * Create Items when initializing the Native Projection
         * The Items holders approve operators to act on their Items using the setApprovalForAll (Main Interface)
         * The operators perform a safeBatchTransferFrom using the Native projection method transferring multiple Items at once
         * must fail: cannot call setApprovalForAll from nativeProjection
         * must fail: cannot call safeBatchTransferFrom from unauthorized address
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [
            [
                [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
                collectionId,
                0, [accounts[1]],
                ["60000000000000000"],
            ],
            [
                [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
                collectionId,
                0, [accounts[1]],
                ["30000000000000000"],
            ],
            [
                [utilities.voidEthereumAddress, "Item3", "I3", "uriItem3"],
                collectionId,
                0, [accounts[2]],
                ["40000000000000000"],
            ],
            [
                [utilities.voidEthereumAddress, "Item4", "I4", "uriItem4"],
                collectionId,
                0, [accounts[2]],
                ["20000000000000000"],
            ],
        ];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var transferAmount = [
            "10000000000000000",
            "2500000000000000",
            "20000000000000000",
            "1000000000000000",
        ];
        var fromAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
        var toAddress = [accounts[3], accounts[3], accounts[4], accounts[4]];
        var operator = [accounts[5], accounts[5], accounts[6], accounts[6]];
        var checkBalFrom = await itemsv2.checkBalances(fromAddress, itemIds);

        var checkBalTo = await itemsv2.checkBalances(toAddress, itemIds);

        var items1 = itemIds.slice(0, 2);
        var items2 = itemIds.slice(2, 4);

        await Promise.all(
            operator.map(async(op, index) => {
                await itemProjection.assertCheckIsApprovedForAll(
                    native.methods.isApprovedForAll(fromAddress[index], op).call(),
                    false
                );
                await native.methods
                    .setApprovalForAll(op, true)
                    .send(
                        blockchainConnection.getSendingOptions({ from: fromAddress[index] })
                    );
                await itemProjection.assertCheckIsApprovedForAll(
                    native.methods.isApprovedForAll(fromAddress[index], op).call(),
                    true
                );
            })
        );

        await catchCall(
            native.methods
            .safeBatchTransferFrom(
                fromAddress[0],
                toAddress[0],
                items1,
                transferAmount.slice(0, 2),
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[9],
                })
            ),
            "amount exceeds allowance"
        );

        await native.methods
            .safeBatchTransferFrom(
                fromAddress[0],
                toAddress[0],
                items1,
                transferAmount.slice(0, 2),
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: operator[0],
                })
            );

        await native.methods
            .safeBatchTransferFrom(
                fromAddress[2],
                toAddress[2],
                items2,
                transferAmount.slice(2, 4),
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: operator[2],
                })
            );

        await itemProjection.assertTransferBalance(
            fromAddress,
            toAddress,
            itemIds,
            transferAmount,
            checkBalFrom,
            checkBalTo,
            native
        );
    });

    it("#644 Items operation: Burn", async() => {
        /**
         * initializing the Native Projection without items to create
         * create Items using the mintItems function
         * Item holders
         * approved operators addresses
         * Functions used in the test:
         * lazyInit
         * Burn
         *
         * Create Items when initializing the Native Projection
         * The Items holders perform a burn using the Native projection burn method
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];

        var CreateItem = await itemsv2.createMintStruct([await native.methods.collectionId().call(), await native.methods.collectionId().call()], [0, 0], [accounts[1], accounts[1]], 1);

        var tx = await native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        var idItems = await itemProjection.getItemIdFromLog(tx);

        var accountsList = CreateItem.map((it) => it.accounts);
        var noneBal = await itemProjection.createNoneBal(accountsList, idItems);
        await itemProjection.assertCheckBalance(noneBal, CreateItem, idItems, native);

        var burnAmount = [
            [CreateItem[0]["amounts"][0]],
            [CreateItem[1]["amounts"][0]]
        ];
        var burnAddress = [
            [CreateItem[0]["accounts"][0]],
            [CreateItem[1]["accounts"][0]]
        ];
        var checkBal = await itemsv2.checkBalances(
            [CreateItem[0]["accounts"][0], CreateItem[1]["accounts"][0]],
            idItems
        );

        await catchCall(
            native.methods
            .burn(utilities.voidEthereumAddress, idItems[0], "1000", "0x")
            .send(blockchainConnection.getSendingOptions({ from: burnAddress[0][0] })),
            "required account");

        await Promise.all(
            burnAmount.map(async(item, index) => {
                await Promise.all(
                    item.map(async(it, i) => {
                        await native.methods
                            .burn(burnAddress[index][i], idItems[index], it, "0x")
                            .send(
                                blockchainConnection.getSendingOptions({
                                    from: burnAddress[index][i],
                                })
                            );
                    })
                );
            })
        );

        await itemProjection.assertBurnBalance(
            checkBal,
            burnAmount,
            burnAddress,
            idItems,
            native
        );
    });

    it("#645 Items operation: Burn and approved operators", async() => {
        /**
         * initializing the Native Projection without items to create
         * create Items using the mintItems function
         * Item holders
         * approved operators addresses
         * Functions used in the test:
         * lazyInit
         * setApprovalForAll
         * Burn
         *
         * Create Items when initializing the Native Projection
         * The Items holders approve operators to act on their Items
         * The opertators perform a burn using the Native projection burn method
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];

        var CreateItem = await itemsv2.createMintStruct([await native.methods.collectionId().call(), await native.methods.collectionId().call()], [0, 0], [accounts[1], accounts[1]], 1);

        var randomAccounts = {};
        CreateItem.forEach(it => it.accounts.forEach(account => randomAccounts[account] = true));
        randomAccounts = Object.values(randomAccounts);

        var tx = await native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        var idItems = await itemProjection.getItemIdFromLog(tx);

        var accountsList = CreateItem.map((it) => it.accounts);
        var noneBal = await itemProjection.createNoneBal(accountsList, idItems);
        await itemProjection.assertCheckBalance(noneBal, CreateItem, idItems);

        var idItems = await itemProjection.getItemIdFromLog(tx);

        var burnAmount = [
            [CreateItem[0]["amounts"][0]],
            [CreateItem[1]["amounts"][0]]
        ];
        var burnAddress = [
            [CreateItem[0]["accounts"][0]],
            [CreateItem[1]["accounts"][0]]
        ];
        var operator = [
            [accounts[7]],
            [accounts[8]]
        ];
        var checkBal = await itemsv2.checkBalances(
            [CreateItem[0]["accounts"][0], CreateItem[1]["accounts"][0]],
            idItems
        );

        operator.forEach(account => randomAccounts[account] = true);
        randomAccounts = Object.values(randomAccounts);

        await Promise.all(
            operator.map(async(op, index) => {
                await native.methods.setApprovalForAll(op[0], true).send(
                    blockchainConnection.getSendingOptions({
                        from: burnAddress[index][0],
                    })
                );
                await itemProjection.assertCheckIsApprovedForAll(
                    native.methods.isApprovedForAll(burnAddress[index][0], op[0]).call(),
                    true
                );
            })
        );

        await Promise.all(
            burnAmount.map(async(item, index) => {
                await Promise.all(
                    item.map(async(it, i) => {
                        await catchCall(
                            native.methods
                            .burn(burnAddress[index][i], idItems[index], it, "0x")
                            .send(
                                blockchainConnection.getSendingOptions({
                                    from: accounts.filter(it => randomAccounts.indexOf(it) === -1)[0],
                                })
                            ),
                            "amount exceeds allowance"
                        );
                    })
                );
            })
        );

        await Promise.all(
            burnAmount.map(async(item, index) => {
                await Promise.all(
                    item.map(async(it, i) => {
                        await native.methods
                            .burn(burnAddress[index][i], idItems[index], it, "0x")
                            .send(
                                blockchainConnection.getSendingOptions({
                                    from: operator[index][i],
                                })
                            );
                    })
                );
            })
        );

        await itemProjection.assertBurnBalance(
            checkBal,
            burnAmount,
            burnAddress,
            idItems,
            native
        );
    });

    it("#646 Items operation: burnBatch", async() => {
        /**
         * initializing the Native Projection without items to create
         * create Items using the mintItems function
         * Item holders
         * approved operators addresses
         * Functions used in the test:
         * lazyInit
         * burnBatch
         *
         * Create Items when initializing the Native Projection
         * The Items holders perform a burnBatch using the Native projection method burning multiple Items at once
         *
         * must fail: cannot call setApprovalForAll from nativeProjection
         * must fail: cannot call burnBatch from unauthorized address
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];

        var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: "Item1",
                    symbol: "I1",
                    uri: "uriItem1",
                },
                collectionId: await native.methods.collectionId().call(),
                id: 0,
                accounts: [accounts[1]],
                amounts: ["50000000000000000"],
            },
            {
                header: {
                    host: accounts[1],
                    name: "Item2",
                    symbol: "I2",
                    uri: "uriItem2",
                },
                collectionId: await native.methods.collectionId().call(),
                id: 0,
                accounts: [accounts[1]],
                amounts: ["60000000000000000"],
            },
            {
                header: {
                    host: accounts[1],
                    name: "Item3",
                    symbol: "I3",
                    uri: "uriItem3",
                },
                collectionId: await native.methods.collectionId().call(),
                id: 0,
                accounts: [accounts[2]],
                amounts: ["50000000000000000"],
            },
            {
                header: {
                    host: accounts[1],
                    name: "Item4",
                    symbol: "I4",
                    uri: "uriItem4",
                },
                collectionId: await native.methods.collectionId().call(),
                id: 0,
                accounts: [accounts[2]],
                amounts: ["60000000000000000"],
            },
        ];

        var tx = await native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        var idItems = await itemProjection.getItemIdFromLog(tx);

        var accountsList = CreateItem.map((it) => it.accounts);
        var noneBal = await itemProjection.createNoneBal(accountsList, idItems);
        await itemProjection.assertCheckBalance(noneBal, CreateItem, idItems);

        var idItems = await itemProjection.getItemIdFromLog(tx);

        var burnAmount = [
            ["10000000000000000"],
            ["2000000000000000"],
            ["10000000000000000"],
            ["2000000000000000"],
        ];

        var burnAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
        var checkBal = await itemsv2.checkBalances(
            [accounts[1], accounts[1], accounts[2], accounts[2]],
            idItems
        );

        await catchCall(
            native.methods
            .burnBatch(utilities.voidEthereumAddress, idItems.slice(0, 2), burnAmount.slice(0, 2).flat())
            .send(blockchainConnection.getSendingOptions({ from: burnAddress[0] })),
            "required account"
        );

        await native.methods
            .burnBatch(
                burnAddress[0],
                idItems.slice(0, 2),
                burnAmount.slice(0, 2).flat()
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: burnAddress[0],
                })
            );

        await native.methods
            .burnBatch(
                burnAddress[2],
                idItems.slice(2, 4),
                burnAmount.slice(2, 4).flat()
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: burnAddress[2],
                })
            );

        await itemProjection.assertBurnBalance(
            checkBal,
            burnAmount,
            burnAddress,
            idItems,
            native
        );
    });

    it("#647 Items operation: burnBatch and approved operators", async() => {
        /**
         * initializing the Native Projection without items to create
         * create Items using the mintItems function
         * Item holders
         * approved operators addresses
         * Functions used in the test:
         * lazyInit
         * setApprovalForAll
         * burnBatch
         *
         * Create Items when initializing the Native Projection
         * The Items holders approve operators to act on their Items
         * The operators perform a burnBatch using the Native projection method burning multiple Items at once
         * must fail: cannot call setApprovalForAll from nativeProjection
         * must fail: cannot call burnBatch from unauthorized address
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];

        var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: "Item1",
                    symbol: "I1",
                    uri: "uriItem1",
                },
                collectionId: await native.methods.collectionId().call(),
                id: 0,
                accounts: [accounts[1]],
                amounts: ["50000000000000000"],
            },
            {
                header: {
                    host: accounts[1],
                    name: "Item2",
                    symbol: "I2",
                    uri: "uriItem2",
                },
                collectionId: await native.methods.collectionId().call(),
                id: 0,
                accounts: [accounts[1]],
                amounts: ["60000000000000000"],
            },
            {
                header: {
                    host: accounts[1],
                    name: "Item3",
                    symbol: "I3",
                    uri: "uriItem3",
                },
                collectionId: await native.methods.collectionId().call(),
                id: 0,
                accounts: [accounts[2]],
                amounts: ["50000000000000000"],
            },
            {
                header: {
                    host: accounts[1],
                    name: "Item4",
                    symbol: "I4",
                    uri: "uriItem4",
                },
                collectionId: await native.methods.collectionId().call(),
                id: 0,
                accounts: [accounts[2]],
                amounts: ["60000000000000000"],
            },
        ];

        var tx = await native.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        var idItems = await itemProjection.getItemIdFromLog(tx);

        var accountsList = CreateItem.map((it) => it.accounts);
        var noneBal = await itemProjection.createNoneBal(accountsList, idItems);
        await itemProjection.assertCheckBalance(noneBal, CreateItem, idItems);

        var idItems = await itemProjection.getItemIdFromLog(tx);

        var burnAmount = [
            ["10000000000000000"],
            ["2000000000000000"],
            ["10000000000000000"],
            ["2000000000000000"],
        ];
        var operator = [accounts[5], accounts[5], accounts[6], accounts[6]];
        var burnAddress = [accounts[1], accounts[1], accounts[2], accounts[2]];
        var checkBal = await itemsv2.checkBalances(
            [accounts[1], accounts[1], accounts[2], accounts[2]],
            idItems
        );

        await Promise.all(
            operator.map(async(op, index) => {
                await native.methods
                    .setApprovalForAll(op, true)
                    .send(
                        blockchainConnection.getSendingOptions({ from: burnAddress[index] })
                    );
                await itemProjection.assertCheckIsApprovedForAll(
                    native.methods.isApprovedForAll(burnAddress[index], op).call(),
                    true
                );
            })
        );

        await catchCall(
            native.methods
            .burnBatch(
                burnAddress[0],
                idItems.slice(0, 2),
                burnAmount.slice(0, 2).flat()
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[9],
                })
            ),
            "amount exceeds allowance"
        );

        await native.methods
            .burnBatch(
                burnAddress[0],
                idItems.slice(0, 2),
                burnAmount.slice(0, 2).flat()
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: operator[0],
                })
            );

        await native.methods
            .burnBatch(
                burnAddress[2],
                idItems.slice(2, 4),
                burnAmount.slice(2, 4).flat()
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: operator[2],
                })
            );

        await itemProjection.assertBurnBalance(
            checkBal,
            burnAmount,
            burnAddress,
            idItems,
            native
        );
    });

    it("#648 Batch burn operation using the Main Interface methods", async() => {
        /**
         * Authorized subjects:
         * Items holders
         * approved operators
         *
         * Functions used in the test:
         * lazyInit
         * createCollection (main interface)
         *burnBatch (main interface)
         *
         * Create multiple Collection using the Main Interface.
         * Create and initialize a Native Projection with Items
         * Using the main interface batch method burnBatch, a user can manage different Items from different Collection and one of them is the Projection Collection
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };
        var mainCollectionHeader = {
            host: accounts[1],
            name: "Collection2",
            symbol: "COL2",
            uri: "uri2",
        };

        var items = [
            [
                [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
                collectionId,
                0, [accounts[1]],
                ["20000000000000000"],
            ],
            [
                [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
                collectionId,
                0, [accounts[1]],
                ["60000000000000000"],
            ],
        ];

        var mainItems = [];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var result = await itemsv2
            .createCollection(mainCollectionHeader.host, mainItems, undefined, undefined, mainCollectionHeader);
        var collection = result["collectionId"];

        var CreateItemMain = [{
                header: {
                    host: accounts[1],
                    name: "Item3",
                    symbol: "I3",
                    uri: "uriItem3",
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ["800000000000000000"],
            },
            {
                header: {
                    host: accounts[1],
                    name: "Item4",
                    symbol: "I4",
                    uri: "uriItem4",
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ["900000000000000000"],
            },
        ];

        var mintItem = await result.projection.methods
            .mintItems(CreateItemMain)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        var mainItemId = [];

        await Promise.all(
            mintItem.events.CollectionItem.map(async(event, index) => {
                mainItemId.push(event.returnValues["itemId"]);
            })
        );

        var burnAmount = [
            ["10000000000000"],
            ["300000000000000"],
            ["10000000000"],
            ["20000000000000000"],
        ];
        var burnAddress = [accounts[1]];
        var totalItemIds = mainItemId.concat(itemIds).map((item, index) => {
            return [item];
        });

        var checkBal = await itemsv2.checkBalances(
            Array(totalItemIds.length).fill(burnAddress[0]),
            totalItemIds
        );

        await catchCall(
            mainInterface.methods
            .burnBatch(utilities.voidEthereumAddress, mainItemId.concat(itemIds), burnAmount.flat())
            .send(blockchainConnection.getSendingOptions({ from: burnAddress[0] })),
            "zero address"
        );

        await mainInterface.methods
            .burnBatch(
                accounts[1],
                mainItemId.concat(itemIds),
                burnAmount.flat(),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: burnAddress[0] }));
        await itemProjection.assertBurnBalance(
            checkBal,
            burnAmount,
            Array(burnAmount.length).fill(burnAddress[0]),
            mainItemId.concat(itemIds),
            native
        );
    });

    it("#638 Batch transfer operation using the Main Interface methods", async() => {
        /**
         * Authorized subjects:
         * Items holders
         * approved operators
         *
         * Functions used in the test:
         * lazyInit
         * createCollection (main interface)
         *safeBatchTransferFrom (main interface)
         *
         * Create multiple Collection using the Main Interface.
         * Create and initialize a Native Projection with Items
         * Using the main interface batch methods safeBatchTransferFrom, a user can manage different Items from different Collection and one of them is the Projection Collection
         */
        var collectionId = utilities.voidBytes32;

        var collectionHeader = {
            host: accounts[1],
            name: "Collection1",
            symbol: "COL1",
            uri: "uri1",
        };

        var items = [
            [
                [utilities.voidEthereumAddress, "Item1", "I1", "uriItem1"],
                collectionId,
                0, [accounts[1]],
                [300000000000],
            ],
            [
                [utilities.voidEthereumAddress, "Item2", "I2", "uriItem2"],
                collectionId,
                0, [accounts[1]],
                [300000000000],
            ],
        ];

        var itemsMain = [{
                header: {
                    host: accounts[1],
                    name: "Item3",
                    symbol: "I3",
                    uri: "uriItem3",
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ["10000000000000000"],
            },
            {
                header: {
                    host: accounts[1],
                    name: "Item4",
                    symbol: "I4",
                    uri: "uriItem4",
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ["10000000000000000"],
            },
        ];

        var res = await itemsv2.initialization(
            collectionId,
            collectionHeader,
            items,
            accounts[1],
            "URI"
        );
        var native = res["native"];
        var itemIds = res["itemIds"];

        var result = await itemsv2
            .createCollection(collectionHeader.host, itemsMain, undefined, undefined, collectionHeader);
        var idItemsMain = result.itemIds;
        var collectionIdMain = result.collectionId;

        var totalItemsId = itemIds.concat(idItemsMain);

        var totalSupply = await Promise.all(
            totalItemsId.map(
                async(value, key) =>
                await mainInterface.methods.totalSupply(value).call()
            )
        );

        var toAccounts = [accounts[4], accounts[4], accounts[4], accounts[4]];
        var fromAccounts = [accounts[1], accounts[1], accounts[1], accounts[1]];

        var checkBalTo = await itemsv2.checkBalances(toAccounts, totalItemsId);

        var checkBalFrom = await itemsv2.checkBalances(fromAccounts, totalItemsId);
        var transferAmount = 100000000000;

        await catchCall(mainInterface.methods
            .safeBatchTransferFrom(
                utilities.voidEthereumAddress,
                accounts[9],
                totalItemsId,
                Array(toAccounts.length).fill(transferAmount),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "zero address");

        await catchCall(mainInterface.methods
            .safeBatchTransferFrom(
                accounts[1],
                utilities.voidEthereumAddress,
                totalItemsId,
                Array(toAccounts.length).fill(transferAmount),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "zero address");

        await catchCall(mainInterface.methods
            .safeBatchTransferFrom(
                utilities.voidEthereumAddress,
                utilities.voidEthereumAddress,
                totalItemsId,
                Array(toAccounts.length).fill(transferAmount),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "zero address");

        await mainInterface.methods
            .safeBatchTransferFrom(
                accounts[1],
                accounts[4],
                totalItemsId,
                Array(toAccounts.length).fill(transferAmount),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        await itemProjection.assertTransferBalance(
            fromAccounts,
            toAccounts,
            totalItemsId,
            Array(toAccounts.length).fill(transferAmount),
            checkBalFrom,
            checkBalTo,
            native
        );
    });
});