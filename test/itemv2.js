describe("Item V2", () => {

    var ItemMainInterface;
    var ItemInteroperableInterface;

    var itemMainInterface;

    function checkHeader(h1, h2) {
        /**
         * check that 2 object Header are equal
         */
        Object.keys(h1).forEach(key => isNaN(parseInt(key)) && assert.equal(h1[key], h2[key], key));
        Object.keys(h2).forEach(key => isNaN(parseInt(key)) && assert.equal(h1[key], h2[key], key));
    }

    function checkItem(h1, h2) {
        /**
         * check that 2 object CreateItem are equal
         */
        assert.equal(h1['collectionId'], h2['collectionId']);
        checkHeader(h1.header, h2.header);
    }

    function asArray(item, asArray) {
        return !item ? [] : (item instanceof Array ? item : [item]).map(it => it instanceof Array ? it : asArray ? [it] : it);
    }

    async function checkBalances(owners, itemIds, expectedBalances, expectedTotalSupplies) {
        itemIds = asArray(itemIds, (owners = asArray(owners)).length > 1);
        if (owners.length === 0 || itemIds.length === 0) {
            throw new Error("owners and itemIds are empty");
        }
        expectedBalances = asArray(expectedBalances, owners.length > 1);
        expectedTotalSupplies = asArray(expectedTotalSupplies, owners.length > 1);
        var balances = [owners.map(() => '0')];
        var totalSupplies = [owners.map(() => '0')];
        var checkStep = async function checkStep(owner, itemIds, expectedBalances, expectedTotalSupplies) {
            var b = itemIds.map(() => '0');
            var t = itemIds.map(() => '0');
            await Promise.all(itemIds.map(async (_, i) => {
                var itemId = itemIds[i];
                var mainTotalSupply = t[i] = await itemMainInterface.methods.totalSupply(itemId).call();
                var interoperableInterface = await asInteroperableInterface(itemId);
                var interoperableTotalSupply = await interoperableInterface.methods.totalSupply().call();
                assert.equal(mainTotalSupply, interoperableTotalSupply, `totalSupply mismatch for item #${itemId}`);

                expectedTotalSupplies && expectedTotalSupplies.length > 0 && assert.equal(mainTotalSupply, expectedTotalSupplies[i], `expected totalSupply mismatch for item #${itemId}`);

                var mainBalance = b[i] = await itemMainInterface.methods.balanceOf(owner, itemId).call();
                var interoperableBalance = await interoperableInterface.methods.balanceOf(owner).call();

                assert.equal(mainBalance, interoperableBalance, `balanceOf mismatch for owner ${owner} and item #${itemId}`);
                expectedBalances && expectedBalances.length > 0 && assert.equal(mainBalance, expectedBalances[i], `expected balanceOf mismatch for owner ${owner} and item #${itemId}`);
            }));

            var balanceOfBatch = await itemMainInterface.methods.balanceOfBatch(itemIds.map(() => owner), itemIds).call();
            assert.equal(JSON.stringify(b), JSON.stringify(balanceOfBatch), `balanceOfBatch mismatch for owner ${owner}`);
            expectedBalances && expectedBalances.length > 0 && assert.equal(JSON.stringify(expectedBalances), JSON.stringify(b), `expected balanceOfBatch mismatch for owner ${owner}`);
            expectedBalances && expectedBalances.length > 0 && assert.equal(JSON.stringify(expectedBalances), JSON.stringify(balanceOfBatch), `expected balanceOfBatch mismatch for owner ${owner}`);
            return [b, t];
        }
        await Promise.all(owners.map(async (_, i) => {
            var step = await checkStep(owners[i], owners.length === 1 ? itemIds : itemIds[i], owners.length === 1 ? expectedBalances : expectedBalances[i], owners.length === 1 ? expectedTotalSupplies : expectedTotalSupplies[i]);
            balances[i] = step[0];
            totalSupplies[i] = step[1];
        }));
        return {
            balances,
            totalSupplies
        };
    }

    async function asInteroperableInterface(itemId) {
        var c = new web3.eth.Contract(ItemInteroperableInterface.abi, await itemMainInterface.methods.interoperableOf(itemId).call());
        try {
            await blockchainConnection.unlockAccounts(c.options.address);
        } catch(e) {
        }
        return c;
    }

    async function createCollection(host, itemsToMint) {
        var collection = {
            host,
            name : 'Collection',
            symbol : 'COL',
            uri : 'uri'
        };
        var items = !itemsToMint ? [] : itemsToMint.map((it, i) => {
            return {
                header : {
                    host,
                    name : 'Item_' + i,
                    symbol : 'IT_' + i,
                    uri : 'URI_' + i
                },
                collectionId : utilities.voidBytes32,
                id : 0,
                accounts : Object.keys(it),
                amounts : Object.values(it)
            }
        });
        var transaction = await itemMainInterface.methods.createCollection(collection, items).send(blockchainConnection.getSendingOptions());
        var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
        var collectionId = web3.eth.abi.decodeParameter("bytes32", logs.filter(it => it.topics[0] === web3.utils.sha3("Collection(address,address,bytes32)"))[0].topics[3]);
        var itemIds = logs.filter(it => it.topics[0] === web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")).map(it => web3.eth.abi.decodeParameter("uint256", it.topics[3]));
        return {
            collectionId,
            itemIds
        }
    }

    async function deploy() {
        if(itemMainInterface) {
            return;
        }
        var DynamicUriResolver = await compile("../node_modules/@ethereansos/swissknife/contracts/dynamicMetadata/impl/DynamicUriResolver");
        var dynamicUriResolver = await new web3.eth.Contract(DynamicUriResolver.abi).deploy({data : DynamicUriResolver.bin}).send(blockchainConnection.getSendingOptions());
        var itemInteroperableInterface = await new web3.eth.Contract(ItemInteroperableInterface.abi).deploy({ data: ItemInteroperableInterface.bin }).send(blockchainConnection.getSendingOptions());
        var ItemMainInterfaceSupportsInterfaceImplementer = await compile('impl/ItemMainInterfaceSupportsInterfaceImplementer');
        var itemMainInterfaceSupportsInterfaceImplementer = await new web3.eth.Contract(ItemMainInterfaceSupportsInterfaceImplementer.abi).deploy({ data: ItemMainInterfaceSupportsInterfaceImplementer.bin }).send(blockchainConnection.getSendingOptions());
        var singletonUri = "ipfs://ipfs/Qmd7W69mAwyyMuV4XC3YQgSJ6kQVCnSxFqKKFeRX3SAsjJ"
        var dynamicUriResolverAddress = dynamicUriResolver.options.address;
        var itemInteroperableInterfaceAddress = itemInteroperableInterface.options.address;
        var itemMainInterfaceSupportsInterfaceImplementerAddress = itemMainInterfaceSupportsInterfaceImplementer.options.address;
        var host = accounts[1];
        /*dynamicUriResolverAddress = "0x3ff777884412c7CE8A1DA679B4B0CD54f720ab2e";
        itemInteroperableInterfaceAddress = "0x55BbAb8BbEfc49996507b84cccb92C74a0c2be3F";
        itemMainInterfaceSupportsInterfaceImplementerAddress = "0xE4CD064c93Fe94C21884670B3708a7a57dD2AfE3";
        host = "0xc5c85480Ac2e36A680bd0d53084DBaD0Cee9c29A";*/
        var data = web3.eth.abi.encodeParameters(["address", "address"], [itemInteroperableInterfaceAddress, itemMainInterfaceSupportsInterfaceImplementerAddress]);
        data = web3.eth.abi.encodeParameters(["string", "address", "bytes"], [singletonUri, dynamicUriResolverAddress, data]);
        data = web3.eth.abi.encodeParameters(["address", "bytes"], [host, data]);
        itemMainInterface = await new web3.eth.Contract(ItemMainInterface.abi).deploy({ data: ItemMainInterface.bin, arguments : [data] }).send(blockchainConnection.getSendingOptions());
        itemMainInterface = await new web3.eth.Contract(ItemMainInterface.abi, "0x915A22A152654714FcecA3f4704fCf6bd314624c");
        try {
            await blockchainConnection.unlockAccounts(await itemMainInterface.methods.host().call());
        } catch(e) {
        }
        await itemMainInterface.methods.setHost(host).send(blockchainConnection.getSendingOptions({from : await itemMainInterface.methods.host().call()}));
        console.log("Item main interface: " + itemMainInterface.options.address);
    }

    before(async () => {
        ItemMainInterface = await compile('impl/ItemMainInterface');
        ItemInteroperableInterface = await compile('impl/ItemInteroperableInterface');
        await deploy();
    });

    describe("General deployment and changes at singleton main interface level", () => {

        it("#437 Should deploy ItemMainInterface", async () => {
            /**
             * Deploy ItemInteroperableInterface and ItemMainInterface, passing in Constructor:
             * 1) _host address
             * 2) _interoperableInterfaceModel as the previusly deployed interoperableInterface contract address
             * 3) _uriResolver address
             * 4) uriString string
             */
            await deploy();
        });

        /*it("#??? Should change InteroperableInterfaceModel", async () => {
             /**
              * Authorized subjects:
              *  - Collection (singleton main interface) host addres
              * Functions used in the test:
              *  - setInteroperableInterfaceModel(address value)
              *
              * Change the Interoperable Interface Model address of the main interface singleton Collection.
              * This operation can be performed only by the main interface singleton Collection actual host.
              * The actual host can set the new Interoperable Interface Model address replacing the current one.
              *\/
            var oldInteroperableInterfaceModel = await itemMainInterface.methods.interoperableInterfaceModel().call();
            await catchCall(itemMainInterface.methods.setInteroperableInterfaceModel(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions({from : accounts[5]})), "unauthorized");
            await itemMainInterface.methods.setInteroperableInterfaceModel(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions({from: await itemMainInterface.methods.host().call()}));
            assert.notStrictEqual(oldInteroperableInterfaceModel, await itemMainInterface.methods.interoperableInterfaceModel().call());
            assert.equal(utilities.voidEthereumAddress, await itemMainInterface.methods.interoperableInterfaceModel().call());
            await catchCall(createCollection(accounts[3], [{
                [accounts[0]] : utilities.numberToString(1e18)
            }]), "invalid opcode");

            oldInteroperableInterfaceModel = await itemMainInterface.methods.interoperableInterfaceModel().call();
            await catchCall(itemMainInterface.methods.setInteroperableInterfaceModel(itemMainInterface.options.address).send(blockchainConnection.getSendingOptions({from : accounts[5]})), "unauthorized");
            await itemMainInterface.methods.setInteroperableInterfaceModel(itemMainInterface.options.address).send(blockchainConnection.getSendingOptions({from: await itemMainInterface.methods.host().call()}));
            assert.notStrictEqual(oldInteroperableInterfaceModel, await itemMainInterface.methods.interoperableInterfaceModel().call());
            assert.equal(itemMainInterface.options.address, await itemMainInterface.methods.interoperableInterfaceModel().call());
            await catchCall(createCollection(accounts[3], [{
                [accounts[0]] : utilities.numberToString(1e18)
            }]));

            var newInteroperableInterfaceModel = await new web3.eth.Contract(ItemInteroperableInterface.abi).deploy({ data: ItemInteroperableInterface.bin }).send(blockchainConnection.getSendingOptions());
            oldInteroperableInterfaceModel = await itemMainInterface.methods.interoperableInterfaceModel().call();
            await catchCall(itemMainInterface.methods.setInteroperableInterfaceModel(newInteroperableInterfaceModel.options.address).send(blockchainConnection.getSendingOptions({from : accounts[5]})), "unauthorized");
            await itemMainInterface.methods.setInteroperableInterfaceModel(newInteroperableInterfaceModel.options.address).send(blockchainConnection.getSendingOptions({from: await itemMainInterface.methods.host().call()}));
            assert.notStrictEqual(oldInteroperableInterfaceModel, await itemMainInterface.methods.interoperableInterfaceModel().call());
            assert.equal(newInteroperableInterfaceModel.options.address, await itemMainInterface.methods.interoperableInterfaceModel().call());
            await createCollection(accounts[3], [{
                [accounts[0]] : utilities.numberToString(1e18)
            }]);
        });*/

        it("#463 Should change MainInterface URI", async () => {
            /**
              * Authorized subjects:
              *  - Collection (singleton main interface) host addres
              * Functions used in the test:
              *  - setUri(string value)
              *
              * Change the Uri address of the main interface singleton Collection.
              * This operation can be performed only by the main interface singleton Collection actual host.
              * The actual host can set the new Uri address replacing the current one.
              */
            var newURI = '0x05a56e2d52c817161883f50c441c3228cfe54d9f';
            await catchCall(itemMainInterface.methods.setUri(newURI).send(blockchainConnection.getSendingOptions({from : accounts[6]})), "unauthorized");
            await itemMainInterface.methods.setUri(newURI).send(blockchainConnection.getSendingOptions({ from: await itemMainInterface.methods.host().call() }));
            assert.equal(await itemMainInterface.methods.uri().call(), newURI);
        });

        it("#??? Should not change MainInterface URIResolver", async () => {
             /**
              * Authorized subjects:
              *  - Nobody
              * Functions used in the test:
              *  - setUriResolver(address value)
              *
              * Not able to change the UriResolver address of the main interface singleton Collection.
              * This operation can be performed only by the main interface singleton Collection actual host.
              * The actual host can set the new UriResolver address replacing the current one.
              */

            await catchCall(itemMainInterface.methods.setDynamicUriResolver(accounts[5]).send(blockchainConnection.getSendingOptions({ from : accounts[6] })), "unauthorized");
            await catchCall(itemMainInterface.methods.setDynamicUriResolver(accounts[9]).send(blockchainConnection.getSendingOptions({ from: await itemMainInterface.methods.host().call() })), "unauthorized");

            var MyUriRenderer = await compile("../resources/MyUriRenderer");
            var myUriRenderer = await new web3.eth.Contract(MyUriRenderer.abi).deploy({data : MyUriRenderer.bin}).send(blockchainConnection.getSendingOptions());

            var uri = "this is the uri";

            var collectionData = await createCollection(accounts[0], [{
                [accounts[0]] : utilities.numberToString(1e18)
            }]);

            var collection = await itemMainInterface.methods.collection(collectionData.collectionId).call();
            await itemMainInterface.methods.setCollectionsMetadata([collectionData.collectionId], [{...collection, uri}]).send(blockchainConnection.getSendingOptions({from : collection.host}));

            var oldCollection = collection;
            var collection = await itemMainInterface.methods.collection(collectionData.collectionId).call();

            assert.notStrictEqual(oldCollection.uri, collection.uri);
            assert.equal(uri, collection.uri);

            uriResult = await itemMainInterface.methods.collectionUri(collectionData.collectionId).call();
            assert.equal(uri, uriResult);

            uri = web3.eth.abi.encodeParameters(["address", "bytes"], [myUriRenderer.options.address, "0x"]);

            await itemMainInterface.methods.setCollectionsMetadata([collectionData.collectionId], [{...collection, uri}]).send(blockchainConnection.getSendingOptions({from : collection.host}));

            var oldCollection = collection;
            var collection = await itemMainInterface.methods.collection(collectionData.collectionId).call();

            assert.notStrictEqual(oldCollection.uri, collection.uri);
            assert.equal(uri, collection.uri);

            uriResult = await itemMainInterface.methods.collectionUri(collectionData.collectionId).call();
            assert.notStrictEqual(uri, uriResult);
            console.log(uriResult);

            var customString = "Domenicali";
            uri =  web3.eth.abi.encodeParameters(["address", "bytes"], [myUriRenderer.options.address, web3.eth.abi.encodeParameter("string", customString)]);
            await catchCall(itemMainInterface.methods.setUri(uri).send(blockchainConnection.getSendingOptions({from : accounts[6]})), "unauthorized");
            await itemMainInterface.methods.setUri(uri).send(blockchainConnection.getSendingOptions({ from: await itemMainInterface.methods.host().call() }));

            assert.notStrictEqual(uri, await itemMainInterface.methods.uri().call());
            assert.equal(uri, await itemMainInterface.methods.plainUri().call());

            assert.equal(uri, await itemMainInterface.methods.plainUri().call());
            uriResult = await itemMainInterface.methods.uri().call();
            assert.notStrictEqual(uri, uriResult);
            assert.notStrictEqual(-1, uriResult.indexOf(customString));
            console.log(uriResult);
        });

        it("#451 Should change host", async () => {
            /**
             * Authorized subjects:
             *  - Collection (singleton main interface) host address
             * Functions used in the test:
             *  - setHost(address value)
             *
             * Change the host address of the main interface singleton Collection.
             * This operation can be performed only by the main interface singleton Collection actual host.
             * The actual host can set another address as the new singleton main interface host address.
             */
            var oldHost = await itemMainInterface.methods.host().call();
            var newHost = accounts[2];
            assert.strictEqual(oldHost, await itemMainInterface.methods.host().call());
            assert.notStrictEqual(newHost, await itemMainInterface.methods.host().call());
            await catchCall(itemMainInterface.methods.setHost(newHost).send(blockchainConnection.getSendingOptions({ from: accounts[5] })), 'unauthorized');
            await itemMainInterface.methods.setHost(newHost).send(blockchainConnection.getSendingOptions({ from: oldHost }));
            assert.notStrictEqual(oldHost, await itemMainInterface.methods.host().call());
            assert.equal(newHost, await itemMainInterface.methods.host().call());

            oldHost = await itemMainInterface.methods.host().call();
            newHost = utilities.voidEthereumAddress;
            await itemMainInterface.methods.setHost(newHost).send(blockchainConnection.getSendingOptions({ from: oldHost }));
            assert.notStrictEqual(oldHost, await itemMainInterface.methods.host().call());
            assert.equal(newHost, await itemMainInterface.methods.host().call());
            await catchCall(itemMainInterface.methods.setHost(newHost).send(blockchainConnection.getSendingOptions({ from: oldHost })), 'unauthorized');
        });
    });

    describe("Create Collections, create and mint Items tests", () => {

        it("#439 Should create a new empty Collection without item", async () => {
            /**
             * Authorized subjects:
             *  - any address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *
             * Create a new empty Collection. To do this you only need to pass the Header Collection and not the CreateItem struct.
             * In this way, a new Collection without Items will be created.
             * The passed parameters in the Header Collection are:
             * Host address
             * Name of the Collection
             * Symbol of the Collection
             * Uri of the Collection
             */

            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];

            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());

            var collection = result.events.Collection.returnValues['collectionId'];

            checkHeader(headerCollection, await itemMainInterface.methods.collection(collection).call());
        });

        it("#441 Should create a non empty Collection with an item", async () => {
            /**
             * Authorized subjects:
             *  - any address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *
             * Create a new no empty Collection with an item inside.
             * First of all, the Header Collection and the CreateItem struct are passed in the createCollection function.
             * In this way, a new Collection with an Item will be created.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var res = result.events.CollectionItem.returnValues;

            var collectionId = res['toCollectionId'];
            var idItems = res['itemId'];

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collectionId,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];
            checkHeader(headerCollection, await itemMainInterface.methods.collection(collectionId).call());
            checkItem(ExpectedResult[0], await itemMainInterface.methods.item(idItems).call());
            assert.equal(await itemMainInterface.methods.totalSupply(idItems).call(), item[0].amounts[0]);
        });

        it("#577 Should create a non empty Collection with adrress(0) as host", async () => {
            /**
             * Authorized subjects:
             *  - any address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *
             * Try to create a new no empty Collection (with items) passing the host Collection address parameter as void address.
             * A Collection following this path can be created because is no empty.
             * By the way, no one will never be able to create other Items inside because the host address is void address.
             */

            var headerCollection = {
                host: utilities.voidEthereumAddress,
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            }];

            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var res = result.events.CollectionItem.returnValues;

            var collectionId = res['toCollectionId'];
            var idItems = res['itemId'];

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collectionId,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            checkHeader(headerCollection, await itemMainInterface.methods.collection(collectionId).call());
            checkItem(ExpectedResult[0], await itemMainInterface.methods.item(idItems).call());
            assert.equal(await itemMainInterface.methods.totalSupply(idItems).call(), item[0].amounts[0]);
            await catchCall(itemMainInterface.methods.mintItems(item).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'unauthorized');
        });

        it("#443 Should not create a new collection with adrress(0) as host and without item info", async () => {
            /**
             * Authorized subjects:
             *  - NONE
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *
             * Try to create a new empty Collection (without items) passing the host Collection address parameter as void address.
             * A Collection following this path cannot be created because is empty and no one will never be able to create Items inside because the host address is void address
             * In this case, the passed parameters in the Header Collection are:
             * Host address -> void address
             * Name of the Collection
             * Symbol of the Collection
             * Uri of the Collection
             */

            var headerCollection = {
                host: utilities.voidEthereumAddress,
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];

            await catchCall(itemMainInterface.methods.createCollection(headerCollection, item), 'empty');
        });

        it("#566 Should create a new no empty Collection with multiple items", async () => {
            /**
             * Authorized subjects:
             *  - any address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *
             * Create a new no empty Collection with multiple items inside.
             * First of all, the Header Collection and the 4 CreateItem structs are passed in the createCollection function.
             * In this way, a new Collection with 4 Items will be created.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var CreateItem = [{
                header: {
                    host: accounts[2],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: 697231,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[2],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: web3.utils.sha3("frankistheboss"),
                id: 777774444,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[2],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: 697231,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[2],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: web3.utils.sha3("frankistheboss"),
                id: 777774444,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            }];

            var result = await itemMainInterface.methods.createCollection(headerCollection, CreateItem).send(blockchainConnection.getSendingOptions());
            var resLog = result.events.CollectionItem;
            var itemIds = resLog.map(event => event.returnValues['itemId']);
            var CollectionId = resLog.map(event => event.returnValues['toCollectionId']);

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: CollectionId[0],
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: CollectionId[0],
                id: 0,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: CollectionId[0],
                id: 0,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: CollectionId[0],
                id: 0,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            }];
            await Promise.all(CreateItem.map(async (event, index) => {
                checkItem(ExpectedResult[index], await itemMainInterface.methods.item(itemIds[index]).call());
                await checkBalances(CreateItem[index].accounts[0], itemIds[index], CreateItem[index].amounts[0], CreateItem[index].amounts[0]);
            }));
        });

        it("#565 Should create Item after create a new empty Collection", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Create a new empty Collection and then create a single item inside.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then an Item is created passing the createItem struct in th mintItems function
             */

            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];


            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            await checkBalances(accounts[1], idItems, CreateItem[0].amounts[0], CreateItem[0].amounts[0]);
            CreateItem[0].header.host = utilities.voidEthereumAddress;
            checkItem(await itemMainInterface.methods.item(idItems).call(), CreateItem[0]);
        });

        it("#567 Should create multiple Items after create a new empty Collection", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Create a new empty Collection and then create new items inside.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then 4 Items are created passing the 4 createItem struct in th mintItems function.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];

            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());

            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[5]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            await Promise.all(mintItem.events.CollectionItem.map(async (event, index) => {
                var itemId = event.returnValues['itemId'];
                CreateItem[index].header.host = utilities.voidEthereumAddress;
                checkItem(CreateItem[index], await itemMainInterface.methods.item(itemId).call());
                await checkBalances(CreateItem[index].accounts[0], itemId, CreateItem[index].amounts[0], CreateItem[index].amounts[0]);
            }));
        });

        it("#445 Should mint Item after create a new no empty Collection with an item", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Create a new no empty Collection with an item inside and then mint that Item.
             * First of all, the Header Collection and the CreateItem struct are passed in the createCollection function.
             * In this way, a new Collection with Items will be created.
             * After creating the Item, the Items is minted through the mintItems function passing the Item id.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collectionRes = result.events.CollectionItem.returnValues;

            var collection = collectionRes['toCollectionId'];
            var itemId = collectionRes['itemId'];

            var checkBal = await checkBalances(accounts[1], itemId);

            var CreateItem = [{
                header: {
                    host: accounts[2],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: itemId,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: itemId,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            checkItem(ExpectedResult[0], await itemMainInterface.methods.item(itemId).call());
            await checkBalances(accounts[1], itemId, checkBal['balances'][0][0].add(CreateItem[0]['amounts'][0]), checkBal['totalSupplies'][0][0].add(CreateItem[0]['amounts'][0]));
        });

        it("#568 Should mint Item after create a new collection with item", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Create a new no empty Collection with an item inside and then mint that Item.
             * First of all, the Header Collection and the CreateItem struct are passed in the createCollection function. In this way, a new Collection with Items will be created.
             * The item is minted using the mintItems function passing the Item id.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var previouslyCreatedCollectionId = await web3.eth.getPastLogs({
                fromBlock: blockchainConnection.forkBlock,
                toBlock: 'latest',
                address: itemMainInterface.options.address,
                topics: [
                    web3.utils.sha3("Collection(address,address,bytes32)")
                ]
            });

            previouslyCreatedCollectionId = web3.eth.abi.decodeParameter("bytes32", previouslyCreatedCollectionId[0].topics[3]);

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: previouslyCreatedCollectionId,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var result = await itemMainInterface.methods.createCollection(headerCollection, CreateItem).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var idItems = result.events.CollectionItem.returnValues['itemId'];

            var MintItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: previouslyCreatedCollectionId,
                id: idItems,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var checkBal = await checkBalances(accounts[1], idItems);

            var mintItem = await itemMainInterface.methods.mintItems(MintItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            checkItem(ExpectedResult[0], await itemMainInterface.methods.item(idItems).call());
            await checkBalances(accounts[1], idItems, checkBal['balances'][0][0].add(MintItem[0]['amounts'][0]), checkBal['totalSupplies'][0][0].add(MintItem[0]['amounts'][0]));
        });

        it("#447 Should mint multiple Items after create a new collection with items", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Create a new no empty Collection with multiple items inside and then mint those Items.
             * First of all, the Header Collection and the CreateItem struct are passed in the createCollection function.
             * In this way, a new Collection with Items will be created.
             * Then those Items are minted usig the mintItems function passing the Item ids
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var result = await itemMainInterface.methods.createCollection(headerCollection, CreateItem).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var idItems = result.events.CollectionItem.map(event => event.returnValues['itemId']);

            var MintItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: idItems[0],
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: idItems[1],
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: idItems[0],
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: idItems[1],
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousTotalSupply = checkBal['totalSupplies'][0]

            var mintItem = await itemMainInterface.methods.mintItems(MintItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await Promise.all(CreateItem.map(async (event, index) => {
                checkItem(ExpectedResult[index], await itemMainInterface.methods.item(idItems[index]).call());
                CreateItem.map(async (value, index) => { assert.equal(await itemMainInterface.methods.totalSupply(idItems[index]).call(), previousTotalSupply[index].add(value.amounts[0])) })
            }));
        });

        it("#576 Mint items for multiple accounts", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Create and mint multiple Items for different accounts receivers.
             * Create a new no empty Collection and 4 new Items.
             * The headerCollection and 4 createItems structs are passed in the createCollection function.
             * Each createItems struct has a different receiver address (accounts parameter) of the item
             * In this way, a new Collection with 4 Items will be created for 4 different accounts.
             * Then the 4 items are minted for those relative receivers addresses
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[5]],
                amounts: ['10000000000000000']
            }];

            var balancePerAddress = [];

            item.forEach((entry, index) => {
                if (!(index in balancePerAddress))
                    balancePerAddress[index] = {};
                entry.accounts.forEach((value, ind) => {
                    if (!(value in balancePerAddress[index])) {
                        balancePerAddress[index][value] = entry['amounts'][ind];
                    } else {
                        balancePerAddress[index][value] = balancePerAddress[index][value].add(entry.amounts[ind]);
                    }
                })
            });
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var idItems = result.events.CollectionItem.map(event => event.returnValues['itemId']);

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousSupply = await Promise.all(idItems.map(async id => await itemMainInterface.methods.totalSupply(id).call()));
            var previousBalance = await Promise.all(item.map(async (it, index) => await itemMainInterface.methods.balanceOf(it['accounts'][0], idItems[index]).call()));

            await Promise.all(item.map(async (event, index) => {
                assert.equal(await itemMainInterface.methods.totalSupply(idItems[index]).call(), event['amounts'][0]);
                assert.equal(await itemMainInterface.methods.balanceOf(event['accounts'][0], idItems[index]).call(), event['amounts'][0]);
            }));

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: idItems[0],
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: idItems[1],
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: idItems[2],
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: idItems[3],
                accounts: [accounts[5]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            await Promise.all(CreateItem.map(async (event, index) => {
                assert.equal(await itemMainInterface.methods.totalSupply(idItems[index]).call(), event['amounts'][0].add(previousSupply[index]));
                assert.equal(await itemMainInterface.methods.balanceOf(event['accounts'][0], idItems[index]).call(), event['amounts'][0].add(previousBalance[index]));
            }));
        });

        it("#575 Create items for multiple accounts", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *
             * Create multiple Items for different accounts receivers.
             * Create a new no empty Collection and 4 new Items.
             * The headerCollection and 4 createItems structs are passed in the createCollection function.
             * Each createItems struct has a different receiver address (accounts parameter) of the item
             * In this way, a new Collection with 4 Items will be created for 4 different accounts.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[5]],
                amounts: ['10000000000000000']
            }];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var idItems = result.events.CollectionItem.map(event => event.returnValues['itemId']);

            await Promise.all(item.map(async (event, index) => {
                await checkBalances(event['accounts'][0], idItems[index], event['amounts'][0], event['amounts'][0]);
            }));
        });

        it("#469 Should mint Item after create a new collection with item but without header", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Create and mint an Item without passing its Header.
             * When an Item is created/minted without passing the Header, the Header must be taken from the Header Collection.
             * First of all, the Header Collection and the CreateItem struct are passed in the createCollection function.
             * In this way, a new Collection with Items will be created.
             * The createItem struct contains an empty Header.
             * Then the created Item is minted passing the createItem struct in the mintItems function.
             * The createItem struct contains an empty header.
             * Both in creating and minting Items with an empty Header, the Contract takes the Header Collection and use it as valid parameters for Items.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var CreateItem = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: '',
                    symbol: '',
                    uri: ''
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var result = await itemMainInterface.methods.createCollection(headerCollection, CreateItem).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var idItems = result.events.CollectionItem.returnValues['itemId'];

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousTotalSupply = checkBal['totalSupplies'][0][0];

            var MintItem = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: '',
                    symbol: '',
                    uri: ''
                },
                collectionId: collection,
                id: idItems,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(MintItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            var ExpectedResult = {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Colection1',
                    symbol: 'C1',
                    uri: 'uriC1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            };

            checkItem(ExpectedResult, await itemMainInterface.methods.item(idItems).call());
            await checkBalances(accounts[1], idItems, checkBal['balances'][0][0].add(MintItem[0]['amounts'][0]), previousTotalSupply.add(MintItem[0]['amounts'][0]));
        });

        it("#571 Should create Item after create a new collection but without header", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Crete an Item without passing its Header.
             * When an Item is created without passing the Header, the Header must be taken from the Header Collection.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then the Item is created passing the createItem stuct in the mintItems function
             * The createItem struct contains an empty Header.
             * Creating an Item with an empty Header, the Contract takes the Header Collection and use it as valid parameters for the Item.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: '',
                    symbol: '',
                    uri: ''
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Colection1',
                    symbol: 'C1',
                    uri: 'uriC1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var itemRes = await itemMainInterface.methods.item(idItems).call();
            assert.equal(itemRes.collectionId, collection);
            checkItem(itemRes, ExpectedResult[0]);
            await checkBalances(accounts[1], idItems, CreateItem[0]['amounts'][0], CreateItem[0]['amounts'][0]);
        });

        it("#527 Create an item with different host address than void address", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Verify that a certain host address, different from void address, cannot be taken as a valid Item host parameter at time of item creation.
             * Create a new no empty Collection with an item inside passing only the headerCollection struct in the createCollection function
             * In this way, a new Collection with Items will be created.
             * Then a new Item is created passing the createItem struct in the mintItems function.
             * The header contains the host address. It cannot be accepted as a valid host address parameter.
             * In fact, the checkItem verifies that the Item is created with a host address equals to void address even if it was passed as a populated address.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var CreateItem = [{
                header: {
                    host: accounts[3],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[5]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[5]],
                amounts: ['10000000000000000']
            }];
            checkItem(await itemMainInterface.methods.item(idItems).call(), ExpectedResult[0]);
        });

        it("#574 Create and mint items with different host", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Verify that a certain host address, different from void address, cannot be taken as a valid Item host parameter at time of item creation and minting.
             * Create a new no empty Collection with an item inside passing only the headerCollection struct in the createCollection function
             * In this way, a new Collection with Items will be created.
             * Then a new Item is created passing the createItem struct in the mintItems function.
             * The header contains an address different from void address address as host address. It cannot be accepted as a valid host address parameter.
             * In fact, the checkItem verifies that the Item is created with a host address equals to void address even if it was passed as an address different from void.
             * Then the Item is minted passing the createItem struct in the mintItems function.
             * Even this time, the header contains the host address. It cannot be accepted as a valid host address parameter.
             * In fact, the checkItem verifies that the Item is minted with a host address equals to void address even if it was passed as an address different from void.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: web3.utils.sha3('test'),
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collectionRes = result.events.CollectionItem.returnValues;

            var collection = collectionRes['toCollectionId'];
            var idItems = collectionRes['itemId'];

            var CreateItem = [{
                header: {
                    host: accounts[4],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: idItems,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: idItems,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            checkItem(await itemMainInterface.methods.item(idItems).call(), ExpectedResult[0]);
            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            checkItem(await itemMainInterface.methods.item(idItems).call(), ExpectedResult[0]);
        });

        it("#579 Create Items using Collections ids and Itemsnids that do not exist", async () => {
            /**
             * Authorized subjects:
             *  - NONE
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Try to create and mint using a Collection id and Items ids that don't exist.
             * Create an empty Collection passig the headerCollection struct in the createCollection function.
             * Create 4 Items passing the 4 createItem struct in the mintItems function.
             * Each of the four createItems contains a collection id and an Item id that do not exist, such as:
             * Item1 -> CollectionId: web3.utils.sha3("cccccollection"), id: 20000
             * Item2 -> web3.utils.sha3("aadadadadadada"), id: 8080
             * The test, through the catchCall veroiies that the items cannot be created with those invalid parameters.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];

            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());

            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: web3.utils.sha3("cccccollection"),
                id: 20000,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: web3.utils.sha3("aadadadadadada"),
                id: 8080,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: web3.utils.sha3("jlkj"),
                id: 8890,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: web3.utils.sha3("cooool"),
                id: 700,
                accounts: [accounts[5]],
                amounts: ['10000000000000000']
            }];

            await catchCall(itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'Unauthorized');
        });

        it("#582 Mint Items from addresses other than host", async () => {
            /**
             * Authorized subjects:
             *  - NONE
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Try to mint multiple items from addresses different from the host address.
             * Create a non empty Collection passig the headerCollection struct and 4 createItem structs in the createCollection function.
             * Then the 4 Items are tried to be minted using the mintItems function called by an address different from the host address.
             * The test, through the catchCall verifies that the items cannot be minted from unauthorized addresses.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var result = await itemMainInterface.methods.createCollection(headerCollection, CreateItem).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var idItems = result.events.CollectionItem.map(event => event.returnValues['itemId']);

            var MintItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: idItems[0],
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: idItems[1],
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: idItems[0],
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: web3.utils.sha3("agnaccacaccalacca"),
                id: idItems[1],
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            await catchCall(itemMainInterface.methods.mintItems(MintItem).send(blockchainConnection.getSendingOptions({ from: accounts[5] })), 'Unauthorized');
        });

        it("#590 Create Items for multiple accounts and amounts", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *
             * Create multiple Items for multiple accounts receivers and multiple amounts.
             * Create a new no empty Collection and 4 new Items.
             * The headerCollection and 4 createItems structs are passed in the createCollection function.
             * Each createItems struct has multiple receiver address (accounts parameter) of the created item,
             * each createItems struct has also multiple amounts (amounts parameter)
             * In this way, a new Collection with 4 Items will be created for 4 multiple accounts.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[2], accounts[3], accounts[5], accounts[2]],
                amounts: ['20000000000000', '10000000000', '30000000000000000', '10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[3], accounts[5], accounts[3], accounts[2]],
                amounts: ['5000000000000000', '900000000000', '10000000000000', '30000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[4], accounts[3], accounts[1], accounts[4]],
                amounts: ['20000000000000000', '30000000000000000', '10000000000000000', '20000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[5], accounts[2], accounts[2], accounts[5]],
                amounts: ['100000000000', '20000000000000000', '30000000000000000', '40000000000000000']
            }];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var idItems = result.events.CollectionItem.map(event => event.returnValues['itemId']);

            var balancePerAddress = [];

            item.forEach((entry, index) => {
                if (!(index in balancePerAddress))
                    balancePerAddress[index] = {};
                entry.accounts.forEach((value, ind) => {
                    if (!(value in balancePerAddress[index])) {
                        balancePerAddress[index][value] = entry['amounts'][ind];
                    } else {
                        balancePerAddress[index][value] = balancePerAddress[index][value].add(entry.amounts[ind]);
                    }
                })
            });

            await Promise.all(item.map(async (event, index) => {
                assert.equal(await itemMainInterface.methods.totalSupply(idItems[index]).call(), event['amounts'].reduce((total, arg) => total.add(arg), 0));
                await Promise.all(event['accounts'].map(async (entry, ind) => {
                    assert.equal(await itemMainInterface.methods.balanceOf(entry, idItems[index]).call(), balancePerAddress[index][entry]);
                }))
            }));
        });

        it("#591 Create and mint Items for multiple accounts and amounts", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *
             * Create multiple Items for multiple accounts receivers and multiple amounts.
             * Create a new no empty Collection and 4 new Items.
             * The headerCollection and 4 createItems structs are passed in the createCollection function.
             * Each createItems struct has multiple receiver address (accounts parameter) of the created item,
             * each createItems struct has also multiple amounts (amounts parameter)
             * In this way, a new Collection with 4 Items will be created for 4 multiple accounts.
             * Then the items are minted passing the 4 createItem structs in the mintItems function
             * Even this time, the accounts[] and amounts[] parameters contain multiple values.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[2], accounts[3], accounts[4], accounts[5]],
                amounts: ['10000000000000000', '100000000000', '20000000000000000', '30000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[3], accounts[3], accounts[4], accounts[5]],
                amounts: ['1000000000000000', '20000000000000000', '10000000000000000', '40000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[4], accounts[3], accounts[2], accounts[4]],
                amounts: ['100000000000000', '20000000000000000', '30000000000000000', '40000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[5], accounts[3], accounts[4], accounts[5]],
                amounts: ['10000000000000000', '20000000000000000', '30000000000000000', '40000000000000000']
            }];

            var balancePerAddress = [];

            item.forEach((entry, index) => {
                if (!(index in balancePerAddress))
                    balancePerAddress[index] = {};
                entry.accounts.forEach((value, ind) => {
                    if (!(value in balancePerAddress[index])) {
                        balancePerAddress[index][value] = entry['amounts'][ind];
                    } else {
                        balancePerAddress[index][value] = balancePerAddress[index][value].add(entry.amounts[ind]);
                    }
                })
            });

            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var idItems = result.events.CollectionItem.map(event => event.returnValues['itemId']);
            var checkBal = await checkBalances(await Promise.all(item.map(async (it, index) => it['accounts'][0])), idItems);
            var previousSupply = checkBal['totalSupplies'];
            var previousBalance = checkBal['balances'];

            await Promise.all(item.map(async (event, index) => {
                await Promise.all(event['accounts'].map(async (entry, ind) => {
                    await checkBalances(entry, idItems[index], balancePerAddress[index][entry], event['amounts'].reduce((total, arg) => total.add(arg), 0));
                }))
            }));

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: idItems[0],
                accounts: [accounts[2], accounts[3], accounts[5], accounts[4]],
                amounts: ['100000000000000', '30000000000000000', '40000000000000000', '30000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: idItems[1],
                accounts: [accounts[3], accounts[2], accounts[2], accounts[4]],
                amounts: ['100000000000000', '20000000000000000', '10000000000000000', '30000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: idItems[2],
                accounts: [accounts[4], accounts[3], accounts[2], accounts[5]],
                amounts: ['10000000000000000', '100000000000000', '20000000000000000', '30000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: idItems[3],
                accounts: [accounts[5], accounts[2], accounts[2], accounts[5]],
                amounts: ['1000000000000', '20000000000000000', '30000000000000000', '40000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            CreateItem.forEach((entry, index) => {
                if (!(index in balancePerAddress))
                    balancePerAddress[index] = {};
                entry.accounts.forEach((value, ind) => {
                    if (!(value in balancePerAddress[index])) {
                        balancePerAddress[index][value] = entry['amounts'][ind];
                    } else {
                        balancePerAddress[index][value] = balancePerAddress[index][value].add(entry.amounts[ind]);
                    }
                })
            });

            await Promise.all(CreateItem.map(async (event, index) => {
                await Promise.all(event['accounts'].map(async (entry, ind) => {
                    await checkBalances(entry, idItems[index], balancePerAddress[index][entry], event['amounts'].reduce((total, arg) => total.add(arg), 0).add(previousSupply[index]));
                }))
            }));
        });

    });
    describe("Items metadata and Collections metadata", () => {

        it("#572 Should change collection metadata", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - setCollectionsMetadata(bytes32[] calldata collectionIds, Header[] calldata values)
             *
             * Change a Collection metadata changing the Header of the Collections.
             * Changing the host address is equals to change the “owner” of the Collection.
             * This operation can be performed only by the Collection host.
             * An empty Collection is created passing the  headerCollection struct in the createcollection function.
             * An4 newCollectionHeader is created. It represents the new Collections metadata
             * The Collections metadata is changed passing the Collection id and the newCollectionHeader in the setCollectionsMetadata
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[2],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };

            var item = [];

            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            checkHeader(await itemMainInterface.methods.collection(collection).call(), headerCollection);
            await itemMainInterface.methods.setCollectionsMetadata([collection], [headerCollection2]).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            checkHeader(await itemMainInterface.methods.collection(collection).call(), headerCollection2);
            await catchCall(itemMainInterface.methods.setCollectionsMetadata([collection], [headerCollection]).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'unauthorized');
        });

        it("#459 Should change multiple collection metadata", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - setCollectionsMetadata(bytes32[] calldata collectionIds, Header[] calldata values)
             *
             * Change multiple Collection metadata changing the Headers of the Collections.
             * Changing the host address is equals to change the “owner” of the Collection.
             * This operation can be performed only by the Collection host.
             * 4 empty Collections are created passing the 4 headerCollection struct in the createcollection function.
             * 4 newCollectionsHeader are created. They represent the new Collections metadata
             * The Collections metadata are changed passing the Collection ids and the 4 newCollectionsHeader in the setCollectionsMetadata
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];

            var newCollectionsHeaders = [
                {
                    host: accounts[3],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1',
                }, {
                    host: accounts[4],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                }, {
                    host: accounts[3],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3',
                }, {
                    host: accounts[4],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                }
            ];

            var collIds = [
                collection, collection2, collection3, collection4
            ];
            await itemMainInterface.methods.setCollectionsMetadata(collIds, newCollectionsHeaders).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            await Promise.all(newCollectionsHeaders.map(async (value, index) => {
                checkHeader(await itemMainInterface.methods.collection(collIds[index]).call(), value);
            }));
        });

        it("#580 Should not change collection metadata without permission", async () => {
            /**
             * Authorized subjects:
             *  - NONE
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - setCollectionsMetadata(bytes32[] calldata collectionIds, Header[] calldata values)
             *
             * Try to change the Collection metadata using the setCollectionsMetadata function from accounts without permission.
             * In fact, this operation can be performed only by the Collection host,
             * if another address tries to change the Collection metadata the require of the setCollectionsMetadata function prevents it.
             * Create a new empty Collection with a host address
             * The Collection metadata is tried to be changed creating the headerCollection2 with the new metadata and passing it in the setColelctionsMetadata function.
             * the setCollectionsMetadata function doesn't change the Collection metadata from the old one (headerCollection1) to the new one (headerCollection2) if it's called by an unauthorized address.
             */

            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            checkHeader(headerCollection, await itemMainInterface.methods.collection(collection).call())

            await catchCall(itemMainInterface.methods.setCollectionsMetadata([collection], [headerCollection2]).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            await catchCall(itemMainInterface.methods.setCollectionsMetadata([collection], [headerCollection2]).send(blockchainConnection.getSendingOptions({ from: accounts[3] })), 'unauthorized');
            await catchCall(itemMainInterface.methods.setCollectionsMetadata([collection], [headerCollection2]).send(blockchainConnection.getSendingOptions({ from: accounts[4] })), 'unauthorized');
            await catchCall(itemMainInterface.methods.setCollectionsMetadata([collection], [headerCollection2]).send(blockchainConnection.getSendingOptions({ from: accounts[5] })), 'unauthorized');
        });

        it("#581 Change an item metadata from multiple people without permission", async () => {
            /**
             * Authorized subjects:
             *  - NONE
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values)
             *
             * Try to change the Item metadata using the setItemsMetadata function from accounts without permission.
             * In fact, this operation can be performed only by the Collection host,
             * if another address tries to change the Item metadata the require of the setItemsMetadata function prevents it.
             * Create a new empty Collection and then create a new item inside.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then a new Item is created passing a createItem struct in the mintItems function.
             * The Item metadata is tried to be changed creating the updateItem with the new metadata and passing it in the setItemsMetadata function.
             * the setItemsMetadata function doesn't change the Item metadata from the old one (creteItem) to the new one (updateItem) if it's called by an unauthorized address.
             */


            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var UpdateItem = [{
                host: accounts[4],
                name: 'Item2',
                symbol: 'I2',
                uri: 'uriItem2'
            }];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            await catchCall(itemMainInterface.methods.setItemsMetadata([idItems], UpdateItem).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            await catchCall(itemMainInterface.methods.setItemsMetadata([idItems], UpdateItem).send(blockchainConnection.getSendingOptions({ from: accounts[3] })), 'unauthorized');
            await catchCall(itemMainInterface.methods.setItemsMetadata([idItems], UpdateItem).send(blockchainConnection.getSendingOptions({ from: accounts[4] })), 'unauthorized');
        });

        it("#513 Should change a single item metadata", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values)
             *
             * Change the Item metadata using the setItemsMetadata function.
             * This operation can be performed only by the Collection host.
             * Create a new empty Collection and then create a new item inside.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then a new Item is created passing a createItem struct in the mintItems function.
             * The Item metadata is changed creating the updateItem with the new metadata and passing it in the setItemsMetadata function.
             * the setItemsMetadata function changes the Item metadata from the old one (creteItem) to the new one (updateItem).
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];
            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var UpdateItem = [{
                host: accounts[4],
                name: 'Item2',
                symbol: 'I2',
                uri: 'uriItem2'
            }];

            await itemMainInterface.methods.setItemsMetadata([idItems], UpdateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            checkItem(await itemMainInterface.methods.item(idItems).call(), ExpectedResult[0]);
        });

        it("#569 Should change multiple item metadata", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - setItemsMetadata(uint256[] calldata itemIds, Header[] calldata values)
             *
             * Change multiple Items metadata.
             * This opeartion can be performed only by the Collection host address.
             * First Create an empty Collection passing the headerCollection.
             * The 4 Items are created passing 4 createItems struct in the mintItems function.
             * Then the metadata are changed using the setItemsMetadata passing the 4 newItemsMetadata representing the new metadata of the the Items
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            }];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var itemIds = result.events.CollectionItem.map(event => event.returnValues['itemId']);
            item.forEach((element) => {
                element.header.host = utilities.voidEthereumAddress;
                element.collectionId = collection;
            });

            var toAccounts = [accounts[1], accounts[2], accounts[3], accounts[4]];

            var checkBal = await checkBalances(toAccounts, itemIds);
            var previousBalance = checkBal['balances'][0];
            var previousTotalSupply = checkBal['totalSupplies'];

            await Promise.all(item.map(async (event, index) => {
                checkItem(item[index], await itemMainInterface.methods.item(itemIds[index]).call());
                await checkBalances(toAccounts, itemIds, previousBalance[index], previousTotalSupply[index][0]);
            }));

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: itemIds[0],
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: itemIds[1],
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: itemIds[2],
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: itemIds[3],
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            var newItemMetadata = [
                {
                    host: accounts[3],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2',
                },
                {
                    host: accounts[4],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3',
                },
                {
                    host: accounts[3],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4',
                },
                {
                    host: accounts[4],
                    name: 'Item5',
                    symbol: 'I5',
                    uri: 'uriItem5',
                }
            ];

            var ExpectedResult = [{
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2',
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3',
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4',
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: utilities.voidEthereumAddress,
                    name: 'Item5',
                    symbol: 'I5',
                    uri: 'uriItem5',
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            await itemMainInterface.methods.setItemsMetadata(itemIds, newItemMetadata).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            var expectedBalance = previousBalance.map((bal, index) => bal.add(CreateItem[index]['amounts'][0]));
            var expectedTotalSuplly = previousTotalSupply[0].map((bal, index) => bal.add(CreateItem[index]['amounts'][0]));

            await Promise.all(CreateItem.map(async (event, index) => {
                checkItem(ExpectedResult[index], await itemMainInterface.methods.item(itemIds[index]).call());
                await checkBalances(toAccounts, itemIds, expectedBalance, expectedTotalSuplly);
            }));
        });

        it("#449 Should change item collection", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - setItemsCollection(uint256[] calldata itemIds, bytes32[] calldata collectionIds)
             *
             * Change the Collection of a given Item from one to another.
             * Changing an Item Collection implies that the Item will answer to the business logic of the new Collection (if any) and to all the others logics related to the Collection operation such as metadata, host, etc..
             * This opeartion can be performed only by the Collection host.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * The headerCollection2 represents the second Collection in which the Item will be moved on.
             * Then an Item is created passing the createItem struct in the mintItems function.
             * At this point the Item1 Collection is changed from Collection 1 to Collection2 passing the Item id and the Collection id of the Collection2 in the setItemsCollection function.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var headerCollection2 = {
                host: accounts[2],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            var itemIds = mintItem.events.CollectionItem.returnValues['itemId'];

            var collections = [collection2];

            var notExistingCollection = [utilities.voidBytes32]

            assert.notEqual(notExistingCollection[0], collection);
            assert.notEqual(notExistingCollection[0], collection2);
            await catchCall(itemMainInterface.methods.setItemsCollection([itemIds], notExistingCollection).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'collection');
            await catchCall(itemMainInterface.methods.setItemsCollection([itemIds], [web3.utils.sha3("i'm an on-the-fly collection id and i should not exist")]).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'collection');

            await itemMainInterface.methods.setItemsCollection([itemIds], collections).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            await catchCall(itemMainInterface.methods.setItemsCollection([itemIds], collections).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), 'unauthorized');

            var ExpectedResult = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            ExpectedResult[0].header.host = utilities.voidEthereumAddress;

            checkItem(ExpectedResult[0], await itemMainInterface.methods.item(itemIds).call());
        });

        it("#570 Should change multiple item Collections", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - setItemsCollection(uint256[] calldata itemIds, bytes32[] calldata collectionIds)
             *
             * Change the Collection of a multiple Items from one to another.
             * Changing an Item Collection implies that the Item will answer to the business logic of the new Collection (if any) and to all the others logics related to the Collection operation such as metadata, host, etc..
             * This opeartion can be performed only by the Collection host.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * The headerCollection2 represents the second Collection in which the Item will be moved on.
             * Then 4 Items aare created passing the 4 createItem struct in the mintItems function.
             * At this point the Item1,2,3 and 4 Collection is changed from Collection 1 to Collection2 passing the Item ids and the Collection id of the Collection2 in the setItemsCollection function.
             */

            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var headerCollection2 = {
                host: accounts[2],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var itemIds = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);

            var collections = [collection2, collection2, collection2, collection2];
            await itemMainInterface.methods.setItemsCollection(itemIds, collections).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            await Promise.all(CreateItem.map(async (event, index) => {
                assert.equal((await itemMainInterface.methods.item(itemIds[index]).call())['collectionId'], collections[index]);
            }));
        });
    });

    describe("Approval tests", () => {

        it("#455 Should approve for specific item", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address, having power of giving the approval on all the items of the owned collection
             *  - item interoperableinterface, having power of giving the approval only on the relative item
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - approve(address operator, address spender, uint256 amount, uint256 itemId)
             *  - safeTransferFrom(address from, address to, uint256 itemId, uint256 amount, bytes calldata data)
             *  - asInteroperableInterface(idItems)
             *  - approve(address spender, uint256 amount) interoperable version
             *  - transferFrom(address sender, address recipient, uint256 amount) interoperable version
             *
             * Approve a single existing Item id using the approve function,
             * it gives approval to a given address to act on a specific item.
             * A new empty Collection is created passing the headerCollection in the mintItems function.
             * The item is created passing the createItem struct in the mintItems function.
             * The approve function is called passing the Item id.
             * Checks on the approved Item are performed through the safeTransferFrom and transferFrom (interoperable version) functions.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var itemIds = mintItem.events.CollectionItem.returnValues['itemId'];
            var checkBal = await checkBalances(accounts[2], itemIds);
            var previousBalance = checkBal['balances'][0][0];

            var transferAmount = 100000000000;
            await catchCall(itemMainInterface.methods.safeTransferFrom(accounts[3], accounts[1], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[3] })), 'exceeds balance');
            await catchCall(itemMainInterface.methods.approve(accounts[1], accounts[3], await itemMainInterface.methods.totalSupply(itemIds).call(), itemIds).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized')
            await itemMainInterface.methods.approve(accounts[1], accounts[3], await itemMainInterface.methods.totalSupply(itemIds).call(), itemIds).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[3], itemIds, 1, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'exceeds allowance');

            transferAmount = 10000000000000;
            await itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[3] }));
            await checkBalances(accounts[2], itemIds, previousBalance.add(transferAmount), await itemMainInterface.methods.totalSupply(itemIds).call());

            transferAmount = 10000000000000;
            checkBal = await checkBalances(accounts[8], itemIds);
            previousBalance = checkBal['balances'][0][0];
            var erc20Contract = await asInteroperableInterface(itemIds);


            CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var UpdateItem = [{
                host: accounts[4],
                name: 'Item3',
                symbol: 'I3',
                uri: 'uriItem3'
            }];

            mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            idItems2 = mintItem.events.CollectionItem.returnValues['itemId'];
            var interoperableInterfaceContract = await asInteroperableInterface(idItems2);

            await erc20Contract.methods.approve(accounts[3], transferAmount).send(blockchainConnection.getSendingOptions({ from: accounts[2] }));
            await erc20Contract.methods.transferFrom(accounts[2], accounts[8], transferAmount).send(blockchainConnection.getSendingOptions({ from: accounts[3] }));
            await catchCall(erc20Contract.methods.transferFrom(accounts[2], accounts[8], transferAmount).send(blockchainConnection.getSendingOptions({ from: interoperableInterfaceContract.options.address })), 'amount exceeds allowance');
            await catchCall(erc20Contract.methods.transferFrom(accounts[2], accounts[8], transferAmount).send(blockchainConnection.getSendingOptions({ from: accounts[8] })), 'amount exceeds allowance');

            await checkBalances(accounts[8], itemIds, previousBalance.add(transferAmount), await itemMainInterface.methods.totalSupply(itemIds).call());

            await itemMainInterface.methods.approve(accounts[1], accounts[6], await itemMainInterface.methods.totalSupply(itemIds).call(), itemIds).send(blockchainConnection.getSendingOptions({ from: erc20Contract.options.address }));
            await itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[6] }));
            await checkBalances(accounts[2], itemIds, previousBalance.add(transferAmount), await itemMainInterface.methods.totalSupply(itemIds).call());

            var burnAmount = 10000000;
            await catchCall(itemMainInterface.methods.burn(accounts[1], itemIds, burnAmount).send(blockchainConnection.getSendingOptions({from : interoperableInterfaceContract.options.address})), 'amount exceeds allowance');
            var transferAmount = 100000;
            await catchCall(itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({from : interoperableInterfaceContract.options.address})), 'amount exceeds allowance');
            await catchCall(itemMainInterface.methods.setItemsMetadata([itemIds], UpdateItem).send(blockchainConnection.getSendingOptions({from : interoperableInterfaceContract.options.address})), 'unauthorized');

            checkBal = await checkBalances(accounts[1], itemIds);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalance = checkBal['balances'][0][0];
            var burnValue = 100000000;
            var encodedParams = web3.eth.abi.encodeParameter(
                {
                    "ParentStruct": {
                        "operator": 'address',
                        "sender": 'address',
                        "recipient": 'address',
                        "itemId": 'uint256',
                        "amount": 'uint256',
                    }
                },
                {
                    "operator": accounts[1],
                    "sender": accounts[1],
                    "recipient": utilities.voidEthereumAddress,
                    "itemId": itemIds,
                    "amount": burnValue,
                }
            );

            await itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: erc20Contract.options.address }));
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], itemIds).call(), previousBalance.sub(burnValue));
            assert.equal(await itemMainInterface.methods.totalSupply(itemIds).call(), previousSupply.sub(burnValue));
            await checkBalances(accounts[1], itemIds, previousBalance.sub(burnValue), previousSupply.sub(burnValue));

            checkBal = await checkBalances(accounts[1], itemIds);
            previousSupply = checkBal['totalSupplies'][0][0];
            previousBalance = checkBal['balances'][0][0];
            await erc20Contract.methods.burn(burnValue).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(erc20Contract.methods.burn(burnValue).send(blockchainConnection.getSendingOptions({ from: interoperableInterfaceContract.options.address })), 'amount exceeds balance');
            await checkBalances(accounts[1], itemIds, previousBalance.sub(burnValue), previousSupply.sub(burnValue));
        });

        it("#453 Should approve for specific collection", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             *  - Address account, he can approves the Collection only if he is the msg.sender of the setApprovalForAll function. The account parameter is the second one of the setApprovalForAll function.
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - isApprovedForAll(address account, address operator)
             *  - setApprovalForAll(address operator, bool approved)
             *  - mintItems(CreateItem[] calldata items)
             *  - burn(address account, uint256 itemId, uint256 amount)
             *  - safeTransferFrom(address from, address to, uint256 itemId, uint256 amount, bytes calldata data)
             *
             * It gives the approval to a given address to act on that Collection id.
             * A new empty Collection is created passing the hederCollection struct in the createCollection function.
             * This function can be used to grant or revoke permission to the operator to transfer the account’s tokens of that specific Collection id,
             * according to the approved parameter that is false to revoke or true to grant permission.
             * Checks are done on another Collection verifying that the Collection is not approved.
             * Checks on the approved Collection are done trhough the burn and safeTransferFrom functions.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];

            assert.equal(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call(), false);
            await itemMainInterface.methods.setApprovalForAll(accounts[3], true).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            assert(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call());

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var itemIds = mintItem.events.CollectionItem.returnValues['itemId'];

            checkBal = await checkBalances(accounts[1], itemIds);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousbalance = checkBal['balances'][0][0];
            var burnAmount = 100000000000;
            await itemMainInterface.methods.burn(accounts[1], itemIds, burnAmount).send(blockchainConnection.getSendingOptions({ from: accounts[3] }));
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], itemIds).call(), previousbalance.sub(burnAmount));


            checkBal = await checkBalances(accounts[1], itemIds);
            balanceOfFromAddress = checkBal['balances'][0][0];

            checkBal = await checkBalances(accounts[2], itemIds);
            var balanceOfToAddress = checkBal['balances'][0][0];

            var transferAmount = 100000000000;
            await itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], itemIds).call(), balanceOfFromAddress.sub(transferAmount));
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[2], itemIds).call(), balanceOfToAddress.add(transferAmount));

            await itemMainInterface.methods.setApprovalForAll(accounts[3], false).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[3] })), 'amount exceeds allowance')

            assert.equal(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call(), false);

            checkBal = await checkBalances(accounts[1], itemIds);
            var previousSupply = checkBal['totalSupplies'][0][0];

            var previousBalance = checkBal['balances'][0][0];

            var burnValue = 100000000;

            var encodedParams = web3.eth.abi.encodeParameter(
                {
                    "ParentStruct": {
                        "operator": 'address',
                        "sender": 'address',
                        "recipient": 'address',
                        "itemId": 'uint256',
                        "amount": 'uint256',
                    }
                },
                {
                    "operator": accounts[1],
                    "sender": accounts[1],
                    "recipient": utilities.voidEthereumAddress,
                    "itemId": itemIds,
                    "amount": burnValue,
                }
            );

            CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            idItems2 = mintItem.events.CollectionItem.returnValues['itemId'];
            var interoperableInterfaceContract = await asInteroperableInterface(idItems2);
            var erc20Contract = await asInteroperableInterface(itemIds);

            await itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: erc20Contract.options.address }));
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], itemIds).call(), previousBalance.sub(burnValue));
            assert.equal(await itemMainInterface.methods.totalSupply(itemIds).call(), previousSupply.sub(burnValue));
            await checkBalances(accounts[1], itemIds, previousBalance.sub(burnValue), previousSupply.sub(burnValue));

            await catchCall(itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: interoperableInterfaceContract.options.address })), 'Unauthorized');
            await catchCall(erc20Contract.methods.transferFrom(accounts[1], accounts[7], transferAmount).send(blockchainConnection.getSendingOptions({ from: interoperableInterfaceContract.options.address })), 'amount exceeds allowance');
            await catchCall(erc20Contract.methods.transferFrom(accounts[1], accounts[7], transferAmount).send(blockchainConnection.getSendingOptions({ from: accounts[8] })), 'amount exceeds allowance');

            checkBal = await checkBalances(accounts[1], itemIds);
            previousSupply = checkBal['totalSupplies'][0][0];
            previousBalance = checkBal['balances'][0][0];

            await erc20Contract.methods.burn(burnValue).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            await checkBalances(accounts[1], itemIds, previousBalance.sub(burnValue), previousSupply.sub(burnValue));
        });

        it("#573 Should not approve for all collections", async () => {
            /**
             * Authorized subjects:
             *  - Collection host address
             *  - Address account, he can approves the Collection only if he is the msg.sender of the setApprovalForAll function. The account parameter is the second one of the setApprovalForAll function.
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - isApprovedForAll(address account, address operator)
             *  - safeTransferFrom(address from, address to, uint256 itemId, uint256 amount, bytes calldata data)
             *  - setApprovalForAll(address account, address operator, bool approved)
             *  - burn(address account, uint256 itemId, uint256 amount)
             *  - safeTransferFrom(address from, address to, uint256 itemId, uint256 amount, bytes calldata data)
             *
             * it verifies that a certain address does not have the approve for a Collection to which it has not been given permission.
             * A new empty Collection is created passing the createItem struct in the mintItems function
             * The isApprovedForAll function returns false because the setApprovalForAll for the operator addess was not called.
             * Then the Collection is approved and checks are done through the safeTransferFrom and burn functions.
             * The Approve from th Collection is removed and its verifiied that the previously approved address can no logner execute operations on that Collection.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var itemIds = mintItem.events.CollectionItem.returnValues['itemId'];

            assert.equal(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call(), false);

            var transferAmount = 100000000000;
            await catchCall(itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[3] })), 'amount exceeds allowance');
            await itemMainInterface.methods.setApprovalForAll(accounts[3], true).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            assert(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call());
            
            var burnAmount = 100000000000;
            checkBal = await checkBalances(accounts[1], itemIds);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousbalance = checkBal['balances'][0][0];
            await itemMainInterface.methods.burn(accounts[1], itemIds, burnAmount).send(blockchainConnection.getSendingOptions({ from: accounts[3] }));
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], itemIds).call(), previousbalance.sub(burnAmount));

            checkBal = await checkBalances(accounts[1], itemIds);
            balanceOfFromAddress = checkBal['balances'][0][0];

            checkBal = await checkBalances(accounts[2], itemIds);
            var balanceOfToAddress = checkBal['balances'][0][0];

            await itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], itemIds).call(), balanceOfFromAddress.sub(transferAmount));
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[2], itemIds).call(), balanceOfToAddress.add(transferAmount));

            await itemMainInterface.methods.setApprovalForAll(accounts[3], false).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[3] })), 'amount exceeds allowance')
            assert.equal(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call(), false);

            checkBal = await checkBalances(accounts[1], itemIds);
            var previousSupply = checkBal['totalSupplies'][0][0];

            var previousBalance = checkBal['balances'][0][0];

            var burnValue = 100000000;
            var encodedParams = web3.eth.abi.encodeParameter(
                {
                    "ParentStruct": {
                        "operator": 'address',
                        "sender": 'address',
                        "recipient": 'address',
                        "itemId": 'uint256',
                        "amount": 'uint256',
                    }
                },
                {
                    "operator": accounts[1],
                    "sender": accounts[1],
                    "recipient": utilities.voidEthereumAddress,
                    "itemId": itemIds,
                    "amount": burnValue,
                }
            );

            CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            idItems2 = mintItem.events.CollectionItem.returnValues['itemId'];
            var interoperableInterfaceContract = await asInteroperableInterface(idItems2);
            var erc20Contract = await asInteroperableInterface(itemIds);

            await itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: erc20Contract.options.address }));
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], itemIds).call(), previousBalance.sub(burnValue));
            assert.equal(await itemMainInterface.methods.totalSupply(itemIds).call(), previousSupply.sub(burnValue));
            await checkBalances(accounts[1], itemIds, previousBalance.sub(burnValue), previousSupply.sub(burnValue));

            await catchCall(erc20Contract.methods.transferFrom(accounts[1], accounts[7], transferAmount).send(blockchainConnection.getSendingOptions({ from: interoperableInterfaceContract.options.address })), 'amount exceeds allowance');
            await catchCall(erc20Contract.methods.transferFrom(accounts[1], accounts[7], transferAmount).send(blockchainConnection.getSendingOptions({ from: accounts[8] })), 'amount exceeds allowance');

            checkBal = await checkBalances(accounts[1], itemIds);
            previousSupply = checkBal['totalSupplies'][0][0];
            previousBalance = checkBal['balances'][0][0];

            await erc20Contract.methods.burn(burnValue).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            await checkBalances(accounts[1], itemIds, previousBalance.sub(burnValue), previousSupply.sub(burnValue));
        });

        it("#521 Should approve for all collection", async () => {
            /**
             * Authorized subjects:
             *  - Address account, he can approves the Collections only if he is the msg.sender of the setApprovalForAll function. The account parameter is the second one of the setApprovalForAll function.
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - isApprovedForAll(address account, address operator)
             *  - setApprovalForAll(address operator, bool approved)
             *  - mintItems(CreateItem[] calldata items)
             *  - safeBatchTransferFrom(address from, address to, uint256[] calldata itemIds, uint256[] calldata amounts, bytes calldata data)
             *  - burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts)
             *
             * Approve all existing Collections of the singleton main interface using the setApprovalForAll
             * A new empty Collection is created passing the hederCollection struct in the createCollection function
             * The setApprovalForAll function is called, passing bytes(0) as Collection id.
             * This means that all Collections must be approved.
             * Checks are done trough the safeBatchTransferFrom and burnBatch functions.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };

            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };

            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            result = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var collection2 = result.events.Collection.returnValues['collectionId'];
            result = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var collection3 = result.events.Collection.returnValues['collectionId'];
            result = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection4 = result.events.Collection.returnValues['collectionId'];
            assert.equal(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call(), false);
            await itemMainInterface.methods.setApprovalForAll(accounts[3], true).send({ from: accounts[1] });
            assert.equal(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call(), true);

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var itemIds = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var totalSupply = await Promise.all(
                itemIds.map(async (value, key) => await itemMainInterface.methods.totalSupply(value).call())
            );

            var toAccounts = [accounts[4], accounts[4], accounts[4], accounts[4]];
            var fromAccounts = [accounts[1], accounts[1], accounts[1], accounts[1]];

            var checkBal = await checkBalances(toAccounts, itemIds);
            var previousBalance = checkBal['balances'];

            checkBal = await checkBalances(fromAccounts, itemIds);
            var previousBalanceFrom = checkBal['balances'];

            var transferAmount = 100000000000;
            await itemMainInterface.methods.safeBatchTransferFrom(accounts[1], accounts[4], itemIds, [transferAmount, transferAmount, transferAmount, transferAmount], "0x").send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

            var expectedBalanceTo = await Promise.all(previousBalance.map((key, value) => key[0].add(transferAmount)));
            var expectedBalanceFrom = await Promise.all(previousBalanceFrom.map((key, value) => key[0].sub(transferAmount)));

            await checkBalances(accounts[4], itemIds, expectedBalanceTo, totalSupply);
            await checkBalances(accounts[1], itemIds, expectedBalanceFrom, totalSupply);

            checkBal = await checkBalances(toAccounts, itemIds);
            previousBalance = checkBal['balances'];

            checkBal = await checkBalances(fromAccounts, itemIds);
            previousBalanceFrom = checkBal['balances'];

            var burnValue = 100000000000;
            await itemMainInterface.methods.burnBatch(accounts[1], itemIds, [burnValue, burnValue, burnValue, burnValue]).send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

            await itemMainInterface.methods.setApprovalForAll(accounts[3], false).send({ from: accounts[1] });

            expectedBalanceFrom = await Promise.all(
                previousBalanceFrom.map((key, value) => key[0].sub(burnValue))
            );

            var expectedTotalSuplly = await Promise.all(
                totalSupply.map((value, key) => value.sub(burnValue))
            );

            await checkBalances(accounts[1], itemIds, expectedBalanceFrom, expectedTotalSuplly);
        });

        it("#457 Should approve for all", async () => {
            /**
             * Authorized subjects:
             *  - any address, in fact any msg.sender can grant or revoke permission to the operator address to act on his tokens
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - isApprovedForAll(address account, address operator)
             *  - setApprovalForAll(address operator, bool approved)
             *  - safeBatchTransferFrom(address from, address to, uint256[] calldata itemIds, uint256[] calldata amounts, bytes calldata data)
             *  - burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts)
             *
             * Approve all existing Collections of the singleton main interface using the setApprovlForAll
             * A new empty Collection is created passing the hederCollection struct in the createCollection function
             * The setApprovalForAll function is called.
             * This means that all Collections must be approved.
             * Checks are done trough the safeBatchTransferFrom and burnBatch functions.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };

            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };

            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            result = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var collection2 = result.events.Collection.returnValues['collectionId'];
            result = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var collection3 = result.events.Collection.returnValues['collectionId'];
            result = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection4 = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var itemIds = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var totalSupply = await Promise.all(itemIds.map(async item => await itemMainInterface.methods.totalSupply(item).call()));

            var toAccounts = [accounts[4], accounts[4], accounts[4], accounts[4]];
            var fromAccounts = [accounts[1], accounts[1], accounts[1], accounts[1]];
            var checkBal = await checkBalances(toAccounts, itemIds);
            var previousBalance = checkBal['balances'];

            checkBal = await checkBalances(fromAccounts, itemIds);
            var previousBalanceFrom = checkBal['balances'];

            assert.equal(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call(), false);

            await itemMainInterface.methods.setApprovalForAll(accounts[3], true).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            assert(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call());

            var transferAmount = 100000000000;
            await itemMainInterface.methods.safeBatchTransferFrom(accounts[1], accounts[4], itemIds, [transferAmount, transferAmount, transferAmount, transferAmount], "0x").send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

            var expectedBalanceTo = await Promise.all(previousBalance.map((key, value) => key[0].add(transferAmount)));
            var expectedBalanceFrom = await Promise.all(previousBalanceFrom.map((key, value) => key[0].sub(transferAmount)));

            await checkBalances(accounts[4], itemIds, expectedBalanceTo, totalSupply);
            await checkBalances(accounts[1], itemIds, expectedBalanceFrom, totalSupply);

            checkBal = await checkBalances(toAccounts, itemIds);
            previousBalance = checkBal['balances'];

            checkBal = await checkBalances(fromAccounts, itemIds);
            previousBalanceFrom = checkBal['balances'];

            var burnValue = 100000000000;
            await itemMainInterface.methods.burnBatch(accounts[1], itemIds, [burnValue, burnValue, burnValue, burnValue]).send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

            expectedBalanceFrom = await Promise.all(previousBalanceFrom.map((key, value) => key[0].sub(burnValue)));
            var expectedTotalSupply = await Promise.all(totalSupply.map(item => item.sub(burnValue)));

            await checkBalances(accounts[4], itemIds, expectedBalanceTo, expectedTotalSupply);
            await checkBalances(accounts[1], itemIds, expectedBalanceFrom, expectedTotalSupply);
            assert.equal(await itemMainInterface.methods.isApprovedForAll(accounts[1], accounts[3]).call(), true);
        });
    });

    describe("Transfer and burn tests", () => {

        it("#465 Should transfer an Item using the transfer method of the interoperable interface", async () => {
            /**
             * Authorized subjects:
             *  - item holder, having an Item amount >= to the amount to be transferred
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - asInteroperableInterface(idItems)
             *  - transfer(address recipient, uint256 amount) interoperable version
             *
             * Transfer an Item from an address to another using the transfer method of the interoperable interface.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then a new Item is created passing the creatitem struct in the mintItems function.
             * Then the interoperable interface address of the created item is retrieved using the interoperableOf method of the main interface passing the item id of the newly created item.
             * The transfer method is used transferring the Item to another accounts address.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: utilities.voidBytes32,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var idItems = result.events.CollectionItem.returnValues['itemId'];

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalance = checkBal['balances'][0][0];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: idItems,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var erc20Contract = await asInteroperableInterface(idItems);

            var transferAmount = '10000000';

            await erc20Contract.methods.transfer(accounts[6], transferAmount).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            assert.equal(await erc20Contract.methods.balanceOf(accounts[6]).call(), transferAmount);
            await checkBalances(accounts[1], idItems, previousBalance.add(CreateItem[0]['amounts'][0]).sub(transferAmount), previousSupply.add(CreateItem[0]['amounts'][0]));
        });

        it("#554 Should transfer an Item using the transferFrom method of the interoperable interface", async () => {
            /**
             * Authorized subjects:
             *  - item holder, having an Item amount >= to the amount to be transferred
             *  - Approved operator address, having an approved Item amount >= to the amount to transfer -> look at #455
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - asInteroperableInterface(idItems)
             *  - transferFrom(address sender, address recipient, uint256 amount) interoperable version
             *
             * Transfer an Item from an address to another using the transferFrom method of the interoperable interface.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then a new Item is created passing the creatitem struct in the mintItems function.
             * Then the interoperable interface address of the created item is retrieved using the interoperableOf method of the main interface passing the item id of the newly created item.
             * The transferFrom method is used transferring the Item to another accounts address.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalanceFrom = checkBal['balances'][0][0];
            checkBal = await checkBalances(accounts[7], idItems);
            var previousBalanceTo = checkBal['balances'][0][0];

            var erc20Contract = await asInteroperableInterface(idItems);
            var approveValue = 300000000;
            await erc20Contract.methods.approve(accounts[6], approveValue).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var transferAmount = 100000000;
            await erc20Contract.methods.transferFrom(accounts[1], accounts[7], transferAmount).send(blockchainConnection.getSendingOptions({ from: accounts[6] }));

            await checkBalances(accounts[7], idItems, previousBalanceTo.add(transferAmount), previousSupply);
            await checkBalances(accounts[1], idItems, previousBalanceFrom.sub(transferAmount), previousSupply);
        });

        it("#525 Should burn using the burn of the interoperable interface", async () => {
            /**
             * Authorized subjects:
             *  - Item holder, having an Item amount >= to the amount to be burned
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - asInteroperableInterface(idItems)
             *  - burn(uint256 amount) interoperable version
             *
             * Burn an Item using the burn method of the interoperable interface.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then a new Item is created passing the createitem struct in the mintItems function.
             * Then the interoperable interface address of the created item is retrieved using the interoperableOf method of the main interface passing the item id of the newly created item.
             * The burn method is called.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];
            var erc20Contract = await asInteroperableInterface(idItems)

            var checkBal = await checkBalances(accounts[1], idItems);
            var prevTotalSupply = checkBal['totalSupplies'][0][0];
            var prevBalance = checkBal['balances'][0][0];

            var burnAmount = 100000;

            await erc20Contract.methods.burn(burnAmount).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            assert.equal(await erc20Contract.methods.balanceOf(accounts[1]).call(), prevBalance.sub(burnAmount));
            await checkBalances(accounts[1], idItems, prevBalance.sub(burnAmount), prevTotalSupply.sub(burnAmount))
            await catchCall(erc20Contract.methods.burn(burnAmount).send(blockchainConnection.getSendingOptions({ from: accounts[6] })), 'amount exceeds balance')
        });

        it("#467 Should transfer single item", async () => {
            /**
             * Authorized subjects:
             *  - Item holder, having an Item amount >= to the amount to be transferred
             *  - Approved operator address, having an approved Item amount >= to the amount to transfer -> look at #455,453,573.
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - safeTransferFrom(address from, address to, uint256 itemId, uint256 amount, bytes calldata data)
             *
             * Transfer an Item from an address to another using the safeTransferFrom of the main Interface.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then an Item is created passing the createItem struct in the mintItems function.
             * The item is transferred from an accounts address to another using the safeTransferFrom function.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            var itemIds = mintItem.events.CollectionItem.returnValues['itemId'];

            assert.equal((await itemMainInterface.methods.balanceOf(accounts[1], itemIds).call()), CreateItem[0]['amounts'][0]);
            var checkBal = await checkBalances(accounts[2], itemIds);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var balanceOfToAddress = checkBal['balances'][0][0];

            var transferAmount = 100000000000;
            await itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], itemIds, transferAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            console.log(balanceOfToAddress.add(transferAmount))
            await checkBalances(accounts[2], itemIds, balanceOfToAddress.add(transferAmount), previousSupply);
            await checkBalances(accounts[1], itemIds, CreateItem[0]['amounts'][0].sub(transferAmount), previousSupply);
        });

        it("#517 Should batch transfer", async () => {
            /**
             * Authorized subjects:
             *  - Items holder, having a Items amount >= to the amounts to be transferred
             *  - Approved operator address, having an approved Items amounts >= to the amounts to transfer -> look at #521,457.
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - safeBatchTransferFrom(address from, address to, uint256[] calldata itemIds, uint256[] calldata amounts, bytes calldata data)
             *
             * Execute a batch transfer of multiple items of the same Collection at once.
             * A new empty Collection is created passing the headerCollection struct in the createCollection function.
             * 4 new Items are created passing 4 createItem struct in the mintItems function.
             * The safeBatchTransferFrom function is called passing the ids of the created items, it transfers items from an accounts address to another with no extra data.
             */
             var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var transferValue = ["100000000000000", "100000000000000", "130000000000000", "1000000000000000"];

            var toAccounts = [accounts[4], accounts[4], accounts[4], accounts[4]];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var prevbalanceOfReceiverBatch = await itemMainInterface.methods.balanceOfBatch(toAccounts, idItems).call();

            var prevbalanceOfReceiver = await Promise.all(toAccounts.map(async (account, index) => await itemMainInterface.methods.balanceOf(account, idItems[index]).call()));
            await Promise.all(prevbalanceOfReceiver.map(async (bal, index) => {
                assert.equal(prevbalanceOfReceiverBatch[index], bal)
            }));

            await itemMainInterface.methods.safeBatchTransferFrom(accounts[1], accounts[4], idItems, transferValue, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var balanceOfReceiver = await itemMainInterface.methods.balanceOfBatch(toAccounts, idItems).call();
            await Promise.all(balanceOfReceiver.map(async (value, index) => {
                assert.equal(prevbalanceOfReceiverBatch[index].add(transferValue[index]), value);
                assert.equal(prevbalanceOfReceiver[index].add(transferValue[index]), value);
                assert.equal(await itemMainInterface.methods.totalSupply(idItems[index]).call(), CreateItem[index].amounts[0]);
            }));
        });

        it("#??? Should batch transfer for different collections", async () => {
            /**
             * Authorized subjects:
             *  - Items holder, having a Items amount >= to the amounts to be transferred
             *  - Approved operator address, having an approved Items amounts >= to the amounts to transfer -> look at #521,457.
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - safeBatchTransferFrom(address from, address to, uint256[] calldata itemIds, uint256[] calldata amounts, bytes calldata data)
             *
             * Execute a batch transfer of multiple items of the same Collection at once.
             * A new empty Collection is created passing the headerCollection struct in the createCollection function.
             * 4 new Items are created passing 4 createItem struct in the mintItems function.
             * The safeBatchTransferFrom function is called passing the ids of the created items, it transfers items from an accounts address to another with no extra data.
             */
            var createCollection = async function createCollection(i) {
                var headerCollection = {
                    host: accounts[1],
                    name: 'Collection' + i,
                    symbol: 'C' + i,
                    uri: 'uriC' + i,
                };

                var item = [];
                var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
                return result.events.Collection.returnValues['collectionId'];
            };

            var collectionIds = await Promise.all([0, 0, 0, 0].map((_, i) => createCollection(i)));
            var collection = collectionIds[0];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collectionIds[1],
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collectionIds[2],
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collectionIds[3],
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var transferValue = ["100000000000000", "100000000000000", "130000000000000", "1000000000000000"];

            var toAccounts = [accounts[4], accounts[4], accounts[4], accounts[4]];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var prevbalanceOfReceiverBatch = await itemMainInterface.methods.balanceOfBatch(toAccounts, idItems).call();

            var prevbalanceOfReceiver = await Promise.all(toAccounts.map(async (account, index) => await itemMainInterface.methods.balanceOf(account, idItems[index]).call()));
            await Promise.all(prevbalanceOfReceiver.map(async (bal, index) => {
                assert.equal(prevbalanceOfReceiverBatch[index], bal)
            }));

            await itemMainInterface.methods.safeBatchTransferFrom(accounts[1], accounts[4], idItems, transferValue, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var balanceOfReceiver = await itemMainInterface.methods.balanceOfBatch(toAccounts, idItems).call();
            await Promise.all(balanceOfReceiver.map(async (value, index) => {
                assert.equal(prevbalanceOfReceiverBatch[index].add(transferValue[index]), value);
                assert.equal(prevbalanceOfReceiver[index].add(transferValue[index]), value);
                assert.equal(await itemMainInterface.methods.totalSupply(idItems[index]).call(), CreateItem[index].amounts[0]);
            }));
        });

        it("#529 should burn an Item without data", async () => {
            /**
             * Authorized subjects:
             *  - Item holder, having an Item amount >= to the amount to be burned
             *  - Approved operator address, having an approved Item amount >= to the amount to burn -> look at #453,573.
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - burn(address account, uint256 itemId, uint256 amount)
             *
             * Burn an Item using the burn (no data) method of the main interface. It's the classic ERC1155 burn function.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then a new Item is created inside the newly created Collection passing the createItems struct in the mintItems function.
             * The burn method is called passing the item id to burn.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalance = checkBal['balances'][0][0];

            var burnAmount = 100000000;

            await itemMainInterface.methods.burn(accounts[1], idItems, burnAmount).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            assert.equal(await itemMainInterface.methods.totalSupply(idItems).call(), previousBalance.sub(burnAmount));
            await checkBalances(accounts[1], idItems, previousBalance.sub(burnAmount), previousSupply.sub(burnAmount));
        });

        it("#530 should burn batch Items without data", async () => {
            /**
             * Authorized subjects:
             *  - Items holder, having an Items amounts >= to the amount to be burned
             *  - Approved operator address, having an approved Items amounts >= to the amounts to transfer -> look at #521,457.
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts)
             *
             * Burn multiple Items using the burnBatch (no data) method of the main interface. It's the classic ERC1155 burnBatch function.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * The burnBatch method is called passing the item ids to burn.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },

            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);

            var burnValue = [100000000, 200000000, 500000000, 2000000];

            var toAccounts = [accounts[1], accounts[1], accounts[1], accounts[1]];

            var checkBal = await checkBalances(toAccounts, idItems);
            var previousBalance = checkBal['totalSupplies'];
            var previousTotalSupply = checkBal['balances'];

            var expectedBalance = previousBalance.map((bal, index) => bal[0].sub(burnValue[index]));
            var expectedTotalSuplly = previousTotalSupply.map((bal, index) => bal[0].sub(burnValue[index]));

            await itemMainInterface.methods.burnBatch(accounts[1], idItems, burnValue).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await checkBalances(toAccounts, idItems, expectedBalance, expectedTotalSuplly);
        });

        it("#??? should burn batch Items of different collections without data", async () => {
            /**
             * Authorized subjects:
             *  - Items holder, having an Items amounts >= to the amount to be burned
             *  - Approved operator address, having an approved Items amounts >= to the amounts to transfer -> look at #521,457.
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts)
             *
             * Burn multiple Items using the burnBatch (no data) method of the main interface. It's the classic ERC1155 burnBatch function.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * The burnBatch method is called passing the item ids to burn.
             */
             var createCollection = async function createCollection(i) {
                var headerCollection = {
                    host: accounts[1],
                    name: 'Collection' + i,
                    symbol: 'C' + i,
                    uri: 'uriC' + i,
                };

                var item = [];
                var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
                return result.events.Collection.returnValues['collectionId'];
            };

            var collectionIds = await Promise.all([0, 0, 0, 0].map((_, i) => createCollection(i)));
            var collection = collectionIds[0];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collectionIds[1],
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collectionIds[2],
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collectionIds[3],
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);

            var burnValue = [100000000, 200000000, 500000000, 2000000];

            var toAccounts = [accounts[1], accounts[1], accounts[1], accounts[1]];

            var checkBal = await checkBalances(toAccounts, idItems);
            var previousBalance = checkBal['totalSupplies'];
            var previousTotalSupply = checkBal['balances'];

            var expectedBalance = previousBalance.map((bal, index) => bal[0].sub(burnValue[index]));
            var expectedTotalSuplly = previousTotalSupply.map((bal, index) => bal[0].sub(burnValue[index]));

            await itemMainInterface.methods.burnBatch(accounts[1], idItems, burnValue).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await checkBalances(toAccounts, idItems, expectedBalance, expectedTotalSuplly);
        });

        it("#548 should burn an Item with data", async () => {
            /**
             * Authorized subjects:
             *  - Item holder, having an Item amount >= to the amount to be burned
             *  - Approved operator address, having an approved Item amount >= to the amount to burn
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - burn(address account, uint256 itemId, uint256 amount, bytes memory)
             *
             * Burn an Item using the burn (with data) method of the main interface. It's not the classic ERC1155 burn function, because it has not the data parameter.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then a new Item is created inside the newly created Collection passing the createItems struct in the mintItems function.
             * The burn method is called passing the item id to burn and the data. The data can contains the address receiver after burning a wrapped Item.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1], accounts[2]],
                amounts: ['10000000000000000', utilities.numberToString(0.3*1e18)]
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousBalance = checkBal['balances'][0][0];
            var previousSupply = checkBal['totalSupplies'][0][0];

            var burnAmount = 100000000;
            await itemMainInterface.methods.burn(accounts[1], idItems, burnAmount, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            assert.equal(await itemMainInterface.methods.totalSupply(idItems).call(), previousSupply.sub(burnAmount));
            await checkBalances(accounts[1], idItems, previousBalance.sub(burnAmount), previousSupply.sub(burnAmount));
        });

        it("#550 should burn batch Items with data", async () => {
            /**
             * Authorized subjects:
             *  - Items holder, having an Items amounts >= to the amount to be burned
             *  - Approved operator address, having an approved Items amounts >= to the amounts to transfer
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory)
             *
             * Burn multiple Items using the burnBatch (with data) method of the main interface. It's not the classic ERC1155 burnBatch function, bacause it has not the data parameter.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * The burnBatch method is called passing the item ids to burn. and the data. The data can contains the address receiver after burning wrapped items.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);

            var burnValue = [100000000, 200000000, 500000000, 2000000];

            var toAccounts = [accounts[1], accounts[1], accounts[1], accounts[1]];

            var checkBal = await checkBalances(toAccounts, idItems);
            var previousBalance = checkBal['balances'][0];
            var previousTotalSupply = checkBal['totalSupplies'];

            var expectedBalance = previousBalance.map((bal, index) => bal.sub(burnValue[index]));
            var expectedTotalSuplly = previousTotalSupply.map((bal, index) => bal[0].sub(burnValue[index]));

            await itemMainInterface.methods.burnBatch(accounts[1], idItems, burnValue, "0x").send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await checkBalances(toAccounts, idItems, expectedBalance, expectedTotalSuplly);
        });

        it("#584 Should try to burn using the burn of the interoperable interface passing amount to burn equals to zero", async () => {
            /**
             * Authorized subjects:
             *  - Item holder, having an Item amount >= to the amount to be burned
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - asInteroperableInterface(idItems)
             *  - burn(uint256 amount) interoperable version
             *
             * Burn an Item using the burn method of the interoperable interface passing an amount to burn equal to 0.
             * First of all, the Header Collection and not the CreateItem struct is passed in the createCollection function.
             * In this way, a new Collection without Items will be created.
             * Then a new Item is created passing the createitem struct in the mintItems function.
             * Then the interoperable interface address of the created item is retrieved using the interoperableOf method of the main interface passing the item id of the newly created item.
             * The burn method is called with amount equal to zero, the function doesn't revert but, simply, it does not output any results.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];
            var erc20Contract = await asInteroperableInterface(idItems)
            var checkBal = await checkBalances(accounts[1], idItems);
            var prevTotalSupply = checkBal['totalSupplies'][0][0];
            var prevBalance = checkBal['balances'][0][0];

            var burnAmount = 0;
            await erc20Contract.methods.burn(burnAmount).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            assert.equal(await erc20Contract.methods.balanceOf(accounts[1]).call(), prevBalance);
            await checkBalances(accounts[1], idItems, prevBalance, prevTotalSupply)
        });

        it("#585 Should try to burn an Item without data passing amount to burn equals to zero", async () => {
            /**
             * Authorized subjects:
             *  - Item holder, having an Item amount >= to the amount to be burned
             *  - Approved operator address, having an approved Item amount >= to the amount to burn
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - burn(address account, uint256 itemId, uint256 amount)
             *
             * Burn an Item using the burn (no data) method of the main interface passing an amount to burn equal to 0.
             * The burn function is the classic ERC1155 burn function.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then a new Item is created inside the newly created Collection passing the createItems struct in the mintItems function.
             * The burn method is called passing the item id to burn and amount equal to zero.
             * The function doesn't revert but, simply, it does not output any results.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];
            var checkBal = await checkBalances(accounts[1], idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalance = checkBal['balances'][0][0];


            var burnAmount = 0;
            await itemMainInterface.methods.burn(accounts[1], idItems, burnAmount).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            assert.equal(await itemMainInterface.methods.totalSupply(idItems).call(), previousBalance);
            await checkBalances(accounts[1], idItems, previousBalance, previousSupply);
        });

        it("#586 Should try to burn batch Items without passing amounts to burn equals to zero", async () => {
            /**
             * Authorized subjects:
             *  - Items holder, having an Items amounts >= to the amount to be burned
             *  - Approved operator address, having an approved Items amounts >= to the amounts to transfer
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts)
             *
             * Burn multiple Items using the burnBatch (no data) method of the main interface passing amounts to burn equal to zero.
             * The burnBtach function is the classic ERC1155 burnBatch function.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * The burnBatch method is called passing the item ids to burn and amounts equal to zero.
             * The burn method is called with amount equal to zero, the function doesn't revert but, simply, it does not output any results.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);

            var burnValue = [0, 0, 0, 0];

            var toAccounts = [accounts[1], accounts[1], accounts[1], accounts[1]];

            var checkBal = await checkBalances(toAccounts, idItems);
            var previousBalance = checkBal['balances'][0];
            var previousTotalSupply = checkBal['totalSupplies'];

            var expectedBalance = previousBalance.map((bal, index) => bal.sub(burnValue[index]));
            var expectedTotalSupply = previousTotalSupply.map((bal, index) => bal[0].sub(burnValue[index]));

            await itemMainInterface.methods.burnBatch(accounts[1], idItems, burnValue).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await checkBalances(toAccounts, idItems, expectedBalance, expectedTotalSupply);
        });
    });

    describe("mintTransferOrBurn function tests", () => {

        it("#532 mintTransferOrBurn mint", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of mint on all the items of the owned collection
             *  - item interoperableinterface, having power of mint only on the relative item
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Mint an Item using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then a new Item is created inside the newly created Collection passing the createItems struct in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is false, you can perform a mint, transfer or burn,
             * in the mint case, the encoded data parameter is composed as follows:
             * address operator
             * address sender -> in case of minting an Item, the sender address is equal to void address
             * address recipient
             * uint256 itemId
             * uint256 amount
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[6]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var checkBal = await checkBalances(accounts[6], idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalance = checkBal['balances'][0][0];

            var burnAmount = 100000000;
            var encodedParams = web3.eth.abi.encodeParameter(
                {
                    "ParentStruct": {
                        "operator": 'address',
                        "sender": 'address',
                        "recipient": 'address',
                        "itemId": 'uint256',
                        "amount": 'uint256',
                    }
                },
                {
                    "operator": accounts[1],
                    "sender": utilities.voidEthereumAddress,
                    "recipient": accounts[6],
                    "itemId": idItems,
                    "amount": burnAmount,
                }
            );
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            await itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await checkBalances(accounts[6], idItems, previousBalance.add(burnAmount), previousSupply.add(burnAmount));
        });

        it("#536 mintTransferOrBurn transfer", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of transfer on all the items of the owned collection
             *  - item interoperableinterface, having power of transfer only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Transfer an Item using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then a new Item is created inside the newly created Collection passing the createItems struct in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is false, you can perform a mint, transfer or burn,
             * in the transfer case case, the encoded data parameter is composed as follows:
             * address operator
             * address sender -> in case of transferring an Item, the sender address must be different from void address
             * address recipient -> in case of transferring an Item, the recipient address must be different from void address
             * uint256 itemId
             * uint256 amount
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var checkBal = await checkBalances(accounts[6], idItems);
            var previousTotalSupply = checkBal['totalSupplies'][0][0];
            var previousToBalance = checkBal['balances'][0][0];

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousFromBalance = checkBal['balances'][0][0];

            var transferValue = 100000000;

            var encodedParams = web3.eth.abi.encodeParameter(
                {
                    "ParentStruct": {
                        "operator": 'address',
                        "sender": 'address',
                        "recipient": 'address',
                        "itemId": 'uint256',
                        "amount": 'uint256',
                    }
                },
                {
                    "operator": accounts[1],
                    "sender": accounts[1],
                    "recipient": accounts[6],
                    "itemId": idItems,
                    "amount": transferValue,
                }
            );
            await itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            await checkBalances(accounts[6], idItems, previousToBalance.add(transferValue), previousTotalSupply);
            await checkBalances(accounts[1], idItems, previousFromBalance.sub(transferValue), previousTotalSupply);


            checkBal = await checkBalances(accounts[2], idItems);
            previousTotalSupply = checkBal['totalSupplies'][0][0];
            previousToBalance = checkBal['balances'][0][0];

            checkBal = await checkBalances(accounts[6], idItems);
            previousFromBalance = checkBal['balances'][0][0];

            var encodedParams = web3.eth.abi.encodeParameter(
                {
                    "ParentStruct": {
                        "operator": 'address',
                        "sender": 'address',
                        "recipient": 'address',
                        "itemId": 'uint256',
                        "amount": 'uint256',
                    }
                },
                {
                    "operator": accounts[6],
                    "sender": accounts[6],
                    "recipient": accounts[2],
                    "itemId": idItems,
                    "amount": transferValue,
                }
            );

            var erc20Contract = await asInteroperableInterface(idItems);

            await itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: erc20Contract.options.address }));
            await checkBalances(accounts[2], idItems, previousToBalance.add(transferValue), previousTotalSupply);
            await checkBalances(accounts[6], idItems, previousFromBalance.sub(transferValue), previousTotalSupply);

            checkBal = await checkBalances(accounts[3], idItems);
            previousBalanceTo = checkBal['balances'][0][0];
            previousSupply = checkBal['totalSupplies'][0][0];

            checkBal = await checkBalances(accounts[2], idItems);
            previousBalanceFrom = checkBal['balances'][0][0];

            await erc20Contract.methods.transfer(accounts[3], transferValue).send(blockchainConnection.getSendingOptions({ from: accounts[2] }));

            await checkBalances(accounts[3], idItems, previousBalanceTo.add(transferValue), previousSupply);
            await checkBalances(accounts[2], idItems, previousBalanceFrom.sub(transferValue), previousSupply);

            checkBal = await checkBalances(accounts[7], idItems);
            previousBalanceTo = checkBal['balances'][0][0];
            previousSupply = checkBal['totalSupplies'][0][0];

            checkBal = await checkBalances(accounts[3], idItems);
            previousBalanceFrom = checkBal['balances'][0][0];

            var approveValue = 300000000;
            await erc20Contract.methods.approve(accounts[6], approveValue).send(blockchainConnection.getSendingOptions({ from: accounts[3] }));
            await erc20Contract.methods.transferFrom(accounts[3], accounts[7], transferValue).send(blockchainConnection.getSendingOptions({ from: accounts[6] }));

            await checkBalances(accounts[7], idItems, previousBalanceTo.add(transferValue), previousSupply);
            await checkBalances(accounts[3], idItems, previousBalanceFrom.sub(transferValue), previousSupply);

            CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var UpdateItem = [{
                host: accounts[4],
                name: 'Item3',
                symbol: 'I3',
                uri: 'uriItem3'
            }];

            mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            idItems2 = mintItem.events.CollectionItem.returnValues['itemId'];
            var interoperableInterfaceContract = await asInteroperableInterface(idItems2);
            var burnAmount = 10000000;
            await catchCall(itemMainInterface.methods.burn(accounts[1], idItems, burnAmount).send(blockchainConnection.getSendingOptions({from : interoperableInterfaceContract.options.address})), 'amount exceeds allowance');
            var transferAmount = 100000;
            await catchCall(itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], idItems, transferAmount, "0x").send(blockchainConnection.getSendingOptions({from : interoperableInterfaceContract.options.address})), 'amount exceeds allowance');
            await catchCall(itemMainInterface.methods.setItemsMetadata([idItems], UpdateItem).send(blockchainConnection.getSendingOptions({from : interoperableInterfaceContract.options.address})), 'unauthorized');
        });

        it("#534 mintTransferOrBurn burn", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of burn on all the items of the owned collection
             *  - item interoperableinterface, having power of burn only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Burn an Item using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then a new Item is created inside the newly created Collection passing the createItems struct in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is false, you can perform a mint, transfer or burn,
             * in the burn case case, the encoded data parameter is composed as follows:
             * address operator
             * address sender
             * address recipient -> in case of burning an Item, the recipient address must be equal to void address
             * uint256 itemId
             * uint256 amount
             */

            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalance = checkBal['balances'][0][0];

            var burnValue = 100000000;
            var encodedParams = web3.eth.abi.encodeParameter(
                {
                    "ParentStruct": {
                        "operator": 'address',
                        "sender": 'address',
                        "recipient": 'address',
                        "itemId": 'uint256',
                        "amount": 'uint256',
                    }
                },
                {
                    "operator": accounts[1],
                    "sender": accounts[1],
                    "recipient": utilities.voidEthereumAddress,
                    "itemId": idItems,
                    "amount": burnValue,
                }
            );
            await itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], idItems).call(), previousBalance.sub(burnValue));
            assert.equal(await itemMainInterface.methods.totalSupply(idItems).call(), previousSupply.sub(burnValue));
            await checkBalances(accounts[1], idItems, previousBalance.sub(burnValue), previousSupply.sub(burnValue));

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalance = checkBal['balances'][0][0];

            var encodedParams = web3.eth.abi.encodeParameter(
                {
                    "ParentStruct": {
                        "operator": 'address',
                        "sender": 'address',
                        "recipient": 'address',
                        "itemId": 'uint256',
                        "amount": 'uint256',
                    }
                },
                {
                    "operator": accounts[1],
                    "sender": accounts[1],
                    "recipient": utilities.voidEthereumAddress,
                    "itemId": idItems,
                    "amount": burnValue,
                }
            );

            var erc20Contract = await asInteroperableInterface(idItems);

            await itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({ from: erc20Contract.options.address }));
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], idItems).call(), previousBalance.sub(burnValue));
            assert.equal(await itemMainInterface.methods.totalSupply(idItems).call(), previousSupply.sub(burnValue));
            await checkBalances(accounts[1], idItems, previousBalance.sub(burnValue), previousSupply.sub(burnValue));

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalance = checkBal['balances'][0][0];

            await erc20Contract.methods.burn(burnValue).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

            await checkBalances(accounts[1], idItems, previousBalance.sub(burnValue), previousSupply.sub(burnValue));

            CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var UpdateItem = [{
                host: accounts[4],
                name: 'Item3',
                symbol: 'I3',
                uri: 'uriItem3'
            }];

            mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            idItems2 = mintItem.events.CollectionItem.returnValues['itemId'];
            var interoperableInterfaceContract = await asInteroperableInterface(idItems2);
            var burnAmount = 10000000;
            await catchCall(itemMainInterface.methods.burn(accounts[1], idItems, burnAmount).send(blockchainConnection.getSendingOptions({from : interoperableInterfaceContract.options.address})), 'amount exceeds allowance');
            var transferAmount = 100000;
            await catchCall(itemMainInterface.methods.safeTransferFrom(accounts[1], accounts[2], idItems, transferAmount, "0x").send(blockchainConnection.getSendingOptions({from : interoperableInterfaceContract.options.address})), 'amount exceeds allowance');
            await catchCall(itemMainInterface.methods.setItemsMetadata([idItems], UpdateItem).send(blockchainConnection.getSendingOptions({from : interoperableInterfaceContract.options.address})), 'unauthorized');
        });

        it("#592 mintTransferOrBurn burn passing amount to burn equals to zero", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of burn on all the items of the owned collection
             *  - item interoperableinterface, having power of burn only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Burn an Item using the mintTransferOrBurn function of the main interface passing an amount to burn equal to zero
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then a new Item is created inside the newly created Collection passing the createItems struct in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is false, you can perform a mint, transfer or burn,
             * in the burn case case, the encoded data parameter is composed as follows:
             * address operator
             * address sender
             * address recipient -> in case of burning an Item, the recipient address must be equal to void address
             * uint256 itemId
             * uint256 amount
             * The burn method is called with amount equal to zero, the function doesn't revert but, simply, it does not output any results.
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({from: accounts[1]}));
            var idItems = mintItem.events.CollectionItem.returnValues['itemId'];

            var checkBal = await checkBalances(accounts[1], idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];
            var previousBalance = checkBal['balances'][0][0];

            var encodedParams = web3.eth.abi.encodeParameter(
                {
                    "ParentStruct": {
                        "operator": 'address',
                        "sender": 'address',
                        "recipient": 'address',
                        "itemId": 'uint256',
                        "amount": 'uint256',
                    }
                },
                {
                    "operator": accounts[1],
                    "sender": accounts[1],
                    "recipient": utilities.voidEthereumAddress,
                    "itemId": idItems,
                    "amount": 0,
                }
            );
            await itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({from: accounts[1]}));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(false, encodedParams).send(blockchainConnection.getSendingOptions({from: accounts[2]})), 'unauthorized');
            assert.equal(await itemMainInterface.methods.balanceOf(accounts[1], idItems).call(), previousBalance);
            assert.equal(await itemMainInterface.methods.totalSupply(idItems).call(), previousSupply);
            await checkBalances(accounts[1], idItems, previousBalance, previousSupply);
        });

        it("#540 mintTransferOrBurn batch classic mint, passing a single tuple", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of mint on all the items of the owned collection
             *  - item interoperableinterface, having power of mint only on the relative item
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Mint multiple Items (batch classic version) using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is true, you can perform a batch classic mint, transfer or burn,
             * In the batch classic mint case, the encoded data parameter must contains the batch bool parameter as true in first position and the data (bytes) parameter componing a single batch composed as follows:
             * Batch1:
             * address operator
             * address sender -> in case of minting multiple Items, the sender address is equal to void address
             * address recipient
             * uint256[] itemIds
             * uint256[] amounts
             */
             var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];


            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var address = [accounts[1], accounts[1], accounts[1], accounts[1]]

            var checkBal = await checkBalances(address, idItems);
            var previousBalance = checkBal['balances'];
            var previousSupply = checkBal['totalSupplies'];

            var mintValue = [100000000, 200000000, 1000000, 400000000];
            var encodedParams = web3.eth.abi.encodeParameters(["address", "address", "address", "uint256[]", "uint256[]"], [accounts[1], utilities.voidEthereumAddress, accounts[1], [idItems[0], idItems[1], idItems[2], idItems[3]], mintValue]);

            encodedParams = web3.eth.abi.encodeParameter("bytes[]", [encodedParams]);

            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [true, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            await Promise.all(CreateItem.map(async (event, index) => {
                await checkBalances(accounts[1], idItems[index], previousBalance[index][0].add(mintValue[index]), previousBalance[index][0].add(mintValue[index]))
            }));
        });

        it("#544 mintTransferOrBurn transfer batch classic, passing a single tuple", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of transfer on all the items of the owned collection
             *  - item interoperableinterface, having power of transfer only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Transfer multiple Items (batch classic version) using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is true, you can perform a batch classic mint, transfer or burn,
             * In the batch calssic transfer case, the encoded data parameter must contains the batch bool parameter as true in first position and the data (bytes) parameter componing a single batch composed as follows:
             * Batch1:
             * address operator
             * address sender -> in case of transferring multiple Items, the sender address must be different from void address
             * address recipient -> in case of transferring multiple Items, the recipient address must be different from void address
             * uint256[] itemIds
             * uint256[] amounts
             */
             var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var toOwners = [accounts[6], accounts[6], accounts[6], accounts[6]];
            var fromOwners = [accounts[1], accounts[1], accounts[1], accounts[1]];

            var checkBal = await checkBalances(toOwners, idItems);
            var previousBalanceTo = checkBal['balances'];
            checkBal = await checkBalances(fromOwners, idItems);
            var previousBalanceFrom = checkBal['balances'];
            var totalSupply = checkBal['totalSupplies'];


            var ammountToTransfer = [200000000, 300000000, 100000000, 190000000];

            var encodedParams = web3.eth.abi.encodeParameters(["address", "address", "address", "uint256[]", "uint256[]"], [fromOwners[0], fromOwners[0], toOwners[0], idItems, ammountToTransfer]);
            encodedParams = web3.eth.abi.encodeParameter("bytes[]", [encodedParams]);
            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [true, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            var expectedToBalances = previousBalanceTo.map((item, index) => item[0].add(ammountToTransfer[index]));
            var expectedFromBalances = previousBalanceFrom.map((item, index) => item[0].sub(ammountToTransfer[index]));

            await Promise.all(CreateItem.map(async (event, index) => {
                await checkBalances(toOwners, idItems, expectedToBalances, totalSupply);
                await checkBalances(fromOwners, idItems, expectedFromBalances, totalSupply);
            }));
        });

        it("#542 mintTransferOrBurn burn batch classic, passing a single tuple", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of burn on all the items of the owned collection
             *  - item interoperableinterface, having power of burn only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Burn multiple Items (batch classic version) using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is true, you can perform a batch classic mint, transfer or burn,
             * In the batch calssic burn case, the encoded data parameter must contains the batch bool parameter as true in first position and the data (bytes) parameter componing a single batch composed as follows:
             * Batch1:
             * address operator
             * address sender
             * address recipient -> in case of transferring multiple Items, the recipient address must be equal to void address
             * uint256[] itemIds
             * uint256[] amounts
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var previousSupply = await Promise.all(idItems.map(async item => await itemMainInterface.methods.totalSupply(item).call()));
            var burnValue = [100000000, 100000000, 100000000, 100000000];
            var encodedParams = web3.eth.abi.encodeParameters(["address", "address", "address", "uint256[]", "uint256[]"], [accounts[1], accounts[1], utilities.voidEthereumAddress, idItems, burnValue]);

            encodedParams = web3.eth.abi.encodeParameter("bytes[]", [encodedParams]);

            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [true, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            await Promise.all(CreateItem.map(async (event, index) => {
                assert.equal(await itemMainInterface.methods.totalSupply(idItems[index]).call(), previousSupply[index].sub(burnValue[index]));
            }));
        });

        it("#594 mintTransferOrBurn burn batch classic passing amounts to burn equals to zero", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of burn on all the items of the owned collection
             *  - item interoperableinterface, having power of burn only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Burn multiple Items (batch classic version) using the mintTransferOrBurn function of the main interface passing amounts to burn equal to zero.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is true, you can perform a batch classic mint, transfer or burn,
             * In the batch calssic burn case, the encoded data parameter must contains the batch bool parameter as true in first position and the data (bytes) parameter componing a single batch composed as follows:
             * Batch1:
             * address operator
             * address sender
             * address recipient -> in case of transferring multiple Items, the recipient address must be equal to void address
             * uint256[] itemIds
             * uint256[] amounts
             * The burn method is called with amount equal to zero, the function doesn't revert but, simply, it does not output any results.
             */

            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },{
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({from: accounts[1]}));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);

            var previousSupply = await Promise.all(idItems.map(async item => await itemMainInterface.methods.totalSupply(item).call()));

            var encodedParams = web3.eth.abi.encodeParameters(["address","address","address","uint256[]","uint256[]"], [accounts[1], accounts[1], utilities.voidEthereumAddress, [idItems[0], idItems[1], idItems[2], idItems[3]], [0, 0, 0, 0]]);

            encodedParams = web3.eth.abi.encodeParameter("bytes[]", [encodedParams]);

            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [true, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({from: accounts[1]}));
            await Promise.all(CreateItem.map(async (event, index) => {
                assert.equal(await itemMainInterface.methods.totalSupply(idItems[index]).call(), previousSupply[index]);
            }));
        });

        it("#589 mintTransferOrBurn transfer batch classic passing multiple tuples", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of transfer on all the items of the owned collection
             *  - item interoperableinterface, having power of transfer only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Transfer multiple Items (batch classic version) using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is true, you can perform a batch classic mint, transfer or burn,
             * In the batch classic transfer case, the encoded data parameter must contains the batch bool parameter as true in first position and the data (bytes) parameter componing multiple batches composed as follows:
             * Batch1:
             * address operator
             * address sender -> in case of transferring multiple Items, the sender address must be different from void address
             * address recipient -> in case of transferring multiple Items, the recipient address must be different from void address
             * uint256[] itemIds
             * uint256[] amounts
             * Batch2:
             * address operator
             * address sender -> in case of transferring multiple Items, the sender address must be different from void address
             * address recipient -> in case of transferring multiple Items, the recipient address must be different from void address
             * uint256[] itemIds
             * uint256[] amounts
             * Batch n...
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var origin = [accounts[1], accounts[1], accounts[1], accounts[1]];
            var sender = [accounts[1], accounts[1], accounts[1], accounts[1]];
            var recipient = [accounts[6], accounts[4], accounts[3], accounts[2]];
            var ammountToTransfer = [[100000000, 200000000, 1000000, 700000000], [300000000, 400000000, 1000000, 200000000], [300000000, 500000000, 100000000, 100000], [300000000, 500000000, 100000000, 100000]];
            var items = [idItems, idItems, idItems, idItems];

            var checkBal = await checkBalances(origin, idItems);
            var previousSupply = checkBal['totalSupplies'][0][0];

            var encodedParams = await Promise.all(ammountToTransfer.map((key, index) => web3.eth.abi.encodeParameters(["address", "address", "address", "uint256[]", "uint256[]"], [origin[index], sender[index], recipient[index], items[index], ammountToTransfer[index]])));
            encodedParams = web3.eth.abi.encodeParameter("bytes[]", encodedParams);
            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [true, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');

            var balancePerAddress = [];

            items.forEach((entry, index) => {
                if (!(index in balancePerAddress))
                    balancePerAddress[index] = {};
                recipient.forEach((value, ind) => {
                    if (!(value in balancePerAddress[index])) {
                        balancePerAddress[index][value] = ammountToTransfer[index][ind];
                    } else {
                        balancePerAddress[index][value] = balancePerAddress[index][value].add(ammountToTransfer[index][ind]);
                    }
                })
            });

            await Promise.all(idItems.map(async (idIt, index) => {
                await checkBalances(recipient[index], idIt, balancePerAddress[index][recipient[index]].toString(), previousSupply);
            }));
        });

        it("#588 mintTransferOrBurn burn batch classic passing multiple tuples", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of burn on all the items of the owned collection
             *  - item interoperableinterface, having power of burn only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Burn multiple Items (batch classic version) using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is true, you can perform a batch classic mint, transfer or burn,
             * In the batch classic burn case, the encoded data parameter must contains the batch bool parameter as true in first position and the data (bytes) parameter componing a multiple batches composed as follows:
             * Batch1:
             * address operator
             * address sender
             * address recipient -> in case of transferring multiple Items, the recipient address must be equal to void address
             * uint256[] itemIds
             * uint256[] amounts
             * Batch2:
             * address operator
             * address sender
             * address recipient -> in case of transferring multiple Items, the recipient address must be equal to void address
             * uint256[] itemIds
             * uint256[] amounts
             * Batch n...
             */
             var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var address = [accounts[1], accounts[1], accounts[1], accounts[1]]

            var checkBal = await checkBalances(address, idItems);
            var previousBalance = checkBal['balances'];
            var previousSupply = checkBal['totalSupplies'];

            var burnValue = [[100000000, 200000000, 1000000, 700000000], [300000000, 400000000, 1000000, 200000000], [300000000, 500000000, 100000000, 100000]];
            var sender;
            var origin = sender = await Promise.all(CreateItem.map(item => item['accounts'][0]));
            var recipient = [utilities.voidEthereumAddress, utilities.voidEthereumAddress, utilities.voidEthereumAddress, utilities.voidEthereumAddress];
            var items = [idItems, idItems, idItems, idItems];

            var encodedParams = await Promise.all(burnValue.map((key, index) => web3.eth.abi.encodeParameters(["address", "address", "address", "uint256[]", "uint256[]"], [origin[index], sender[index], recipient[index], items[index], burnValue[index]])));
            encodedParams = web3.eth.abi.encodeParameter("bytes[]", encodedParams);
            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [true, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            await Promise.all(idItems.map(async (idIt, index) => {
                await checkBalances(accounts[1], idIt, previousBalance[index][0].sub(burnValue.map((value, ind) => value[index]).reduce((total, arg) => total.add(arg), 0)), previousSupply[index][0].sub(burnValue.map((value, ind) => value[index]).reduce((total, arg) => total.add(arg), 0)))
            }));
        });

        it("#587 mintTransferOrBurn mint batch classic passing multiple tuples", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of mint on all the items of the owned collection
             *  - item interoperableinterface, having power of mint only on the relative item
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Mint multiple Items (batch classic version) using the mintTransferOrBurn function of the main interface passing multiple tuples.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is true, you can perform a batch classic mint, transfer or burn,
             * In the batch classic mint case, the encoded data parameter must contains the batch bool parameter as true in first position and the data (bytes) parameter componing multiple batches composed as follows:
             * Batch1:
             * address operator
             * address sender -> in case of minting multiple Items, the sender address is equal to void address
             * address recipient
             * uint256[] itemIds
             * uint256[] amounts
             * Batch2:
             * address operator
             * address sender -> in case of minting multiple Items, the sender address is equal to void address
             * address recipient
             * uint256[] itemIds
             * uint256[] amounts
             * Batch n...
             */
             var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];

            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var address = [accounts[1], accounts[1], accounts[1], accounts[1]]

            var checkBal = await checkBalances(address, idItems);
            var previousBalance = checkBal['balances'];
            var previousSupply = checkBal['totalSupplies'];

            var mintValue = [[100000000, 200000000, 1000000, 700000000], [300000000, 400000000, 1000000, 200000000], [300000000, 500000000, 100000000, 100000]];
            var origin = [accounts[1], accounts[1], accounts[1], accounts[1]];
            var sender = [utilities.voidEthereumAddress, utilities.voidEthereumAddress, utilities.voidEthereumAddress, utilities.voidEthereumAddress];
            var recipient = [accounts[1], accounts[1], accounts[1], accounts[1]];
            var items = [[idItems[0], idItems[1], idItems[2], idItems[3]], [idItems[0], idItems[1], idItems[2], idItems[3]], [idItems[0], idItems[1], idItems[2], idItems[3]]];

            var encodedParams = await Promise.all(mintValue.map((key, index) => web3.eth.abi.encodeParameters(["address", "address", "address", "uint256[]", "uint256[]"], [origin[index], sender[index], recipient[index], items[index], mintValue[index]])));
            encodedParams = web3.eth.abi.encodeParameter("bytes[]", encodedParams);

            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [true, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            await Promise.all(idItems.map(async (idIt, index) => {
                await checkBalances(accounts[1], idIt, previousBalance[index][0].add(mintValue.map((value, ind) => value[index]).reduce((total, arg) => total.add(arg), 0)), previousSupply[index][0].add(mintValue.map((value, ind) => value[index]).reduce((total, arg) => total.add(arg), 0)));
            }));
        });

        it("#562 mintTransferOrBurn burn batch advanced", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of burn on all the items of the owned collection
             *  - item interoperableinterface, having power of burn only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Burn multiple Items (batch advanced version) using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is false, you can perform a batch advanced mint, transfer or burn,
             * In the batch advanced burn case, the encoded data parameter must contains the batch bool parameter as false in first position and the data (bytes) composed as follows:
             * address[] operators
             * address[] senders
             * address[] recipients -> in case of transferring multiple Items, the recipient address must be equal to void address
             * uint256[] itemIds
             * uint256[] amounts
             */
             var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];


            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);

            var previousSupply = await Promise.all(idItems.map(async item => await itemMainInterface.methods.totalSupply(item).call()));

            var burnValue = [100000000, 200000000, 30000000, 43000000];
            var originAddress = [accounts[1], accounts[2], accounts[3], accounts[4]];
            var senderAddress = [accounts[1], accounts[2], accounts[3], accounts[4]];
            var recipientAddress = [utilities.voidEthereumAddress, utilities.voidEthereumAddress, utilities.voidEthereumAddress, utilities.voidEthereumAddress];
            var encodedParams = web3.eth.abi.encodeParameters(["address[]", "address[]", "address[]", "uint256[]", "uint256[]"], [originAddress, senderAddress, recipientAddress, idItems, burnValue]);

            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [false, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            await Promise.all(CreateItem.map(async (event, index) => {
                assert.equal(await itemMainInterface.methods.totalSupply(idItems[index]).call(), previousSupply[index].sub(burnValue[index]));
            }));
        });

        it("#561 mintTransferOrBurn transfer batch advanced", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of transfer on all the items of the owned collection
             *  - item interoperableinterface, having power of transfer only on the relative item
             *  - item holder
             *  - approved operator address
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Transfer multiple Items (batch classic version) using the mintTransferOrBurn function of the main interface.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is false, you can perform a batch advanced mint, transfer or burn,
             * In the batch advanced transfer case, the encoded data parameter must contains the batch bool parameter as false in first position and the data (bytes) parameter composed as follows:
             * address[] operators
             * address[] senders -> in case of transferring multiple Items, the sender address must be different from void address
             * address[] recipients -> in case of transferring multiple Items, the recipient address must be different from void address
             * uint256[] itemIds
             * uint256[] amounts
             */
             var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];


            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);
            var fromOwners = [accounts[1], accounts[2], accounts[3], accounts[4]];
            var toOwners = [accounts[3], accounts[1], accounts[4], accounts[2]];

            var checkBal = await checkBalances(toOwners, idItems);
            var previousBalanceTo = checkBal['balances'];
            var previousSupply = checkBal['totalSupplies'];

            var checkBal = await checkBalances(fromOwners, idItems);
            var previousBalanceFrom = checkBal['balances'];

            var ammountToTransfer = [20000000, 100000000, 1000000, 30000000];

            var encodedParams = web3.eth.abi.encodeParameters(["address[]", "address[]", "address[]", "uint256[]", "uint256[]"], [fromOwners, fromOwners, toOwners, idItems, ammountToTransfer]);
            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [false, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');
            var expectedToBalances = previousBalanceTo.map((item, index) => item[0].add(ammountToTransfer[index]));
            var expectedFromBalances = previousBalanceFrom.map((item, index) => item[0].sub(ammountToTransfer[index]));

            await Promise.all(CreateItem.map(async (event, index) => {
                await checkBalances(toOwners, idItems, expectedToBalances, previousSupply);
                await checkBalances(fromOwners, idItems, expectedFromBalances, previousSupply);
            }));
        });

        it("#563 mintTransferOrBurn mint batch advanced", async () => {
            /**
             * Authorized subjects:
             *  - collection host address, having power of mint on all the items of the owned collection
             *  - item interoperableinterface, having power of mint only on the relative item
             * Functions used in the test:
             *  - createCollection(Header calldata _collection, CreateItem[] calldata items)
             *  - mintItems(CreateItem[] calldata items)
             *  - mintTransferOrBurn(bool isMulti, bytes calldata data)
             *
             * Mint multiple Items (batch advanced version) using the mintTransferOrBurn function of the main interface passing multiple tuples.
             * An empty Collection without Items is created passing only the headerCollection and not the CreateItem struct.
             * Then 4 new Items are created inside the newly created Collection passing the 4 createItems structs in the mintItems function.
             * This function can be used to execute several operations such as mint, transfer or burn and batch transfer of batch burn,
             * the function takes as input the isMulti parameter and the data.
             * If the isMulti is true and the batch bool parameter in the encoded data is false, you can perform a batch advanced mint, transfer or burn,
             * In the batch advanced mint case, the encoded data parameter must contains the batch bool parameter as false in first position and the data (bytes) parameter composed as follows:
             * address[] operators
             * address[] senders -> in case of minting multiple Items, the sender address is equal to void address
             * address[] recipients
             * uint256[] itemIds
             * uint256[] amounts
             */
            var headerCollection = {
                host: accounts[1],
                name: 'Colection1',
                symbol: 'C1',
                uri: 'uriC1',
            };
            var headerCollection2 = {
                host: accounts[1],
                name: 'Colection2',
                symbol: 'C2',
                uri: 'uriC2',
            };
            var headerCollection3 = {
                host: accounts[1],
                name: 'Colection3',
                symbol: 'C3',
                uri: 'uriC3',
            };
            var headerCollection4 = {
                host: accounts[1],
                name: 'Colection4',
                symbol: 'C4',
                uri: 'uriC4',
            };

            var item = [];
            var result = await itemMainInterface.methods.createCollection(headerCollection, item).send(blockchainConnection.getSendingOptions());
            var result2 = await itemMainInterface.methods.createCollection(headerCollection2, item).send(blockchainConnection.getSendingOptions());
            var result3 = await itemMainInterface.methods.createCollection(headerCollection3, item).send(blockchainConnection.getSendingOptions());
            var result4 = await itemMainInterface.methods.createCollection(headerCollection4, item).send(blockchainConnection.getSendingOptions());
            var collection = result.events.Collection.returnValues['collectionId'];
            var collection2 = result2.events.Collection.returnValues['collectionId'];
            var collection3 = result3.events.Collection.returnValues['collectionId'];
            var collection4 = result4.events.Collection.returnValues['collectionId'];


            var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: 'Item1',
                    symbol: 'I1',
                    uri: 'uriItem1'
                },
                collectionId: collection,
                id: 0,
                accounts: [accounts[1]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item2',
                    symbol: 'I2',
                    uri: 'uriItem2'
                },
                collectionId: collection2,
                id: 0,
                accounts: [accounts[2]],
                amounts: ['10000000000000000']
            }, {
                header: {
                    host: accounts[1],
                    name: 'Item3',
                    symbol: 'I3',
                    uri: 'uriItem3'
                },
                collectionId: collection3,
                id: 0,
                accounts: [accounts[3]],
                amounts: ['10000000000000000']
            },
            {
                header: {
                    host: accounts[1],
                    name: 'Item4',
                    symbol: 'I4',
                    uri: 'uriItem4'
                },
                collectionId: collection4,
                id: 0,
                accounts: [accounts[4]],
                amounts: ['10000000000000000']
            }];

            var mintItem = await itemMainInterface.methods.mintItems(CreateItem).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            var idItems = mintItem.events.CollectionItem.map(event => event.returnValues['itemId']);

            var mintValue = [100000000, 300000000, 400000000, 1000000];
            var mintAddress = [accounts[1], accounts[3], accounts[2], accounts[4]]
            var encodedParams = web3.eth.abi.encodeParameters(["address[]", "address[]", "address[]", "uint256[]", "uint256[]"], [mintAddress, [utilities.voidEthereumAddress, utilities.voidEthereumAddress, utilities.voidEthereumAddress, utilities.voidEthereumAddress], mintAddress, idItems, mintValue]);
            var checkBal = await checkBalances(mintAddress, idItems);
            var previousBalanceTo = checkBal['balances'];
            var previousSupply = checkBal['totalSupplies'];

            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [false, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
            await catchCall(itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions({ from: accounts[2] })), 'unauthorized');

            var expectedToBalances = previousBalanceTo.map((item, index) => item[0].add(mintValue[index]));
            var expectedTotalSupply = previousSupply.map((item, index) => item[0].add(mintValue[index]));

            await Promise.all(CreateItem.map(async (event, index) => {
                await checkBalances(mintAddress, idItems, expectedToBalances, expectedTotalSupply)
            }));
        });

        it("#??? mintTransferOrBurn multi single", async () => {
            //3 collections, 1 mint, 1 transfer, 1 burn

            var createCollectionAndItems = async function createCollectionAndItems(index, itemsLength) {
                var _collection = {
                    host: accounts[0],
                    name: 'Colection_' + index,
                    symbol: 'C_' + index,
                    uri: 'uriC_' + index,
                };
                var items = [];
                for(var i = 0; i < itemsLength; i++) {
                    items.push({
                        header: {
                            host: utilities.voidEthereumAddress,
                            name: 'Item_' + index + '_' + i,
                            symbol: 'I_' + index + '_' + i,
                            uri: 'uriItem_' + index + '_' + i
                        },
                        collectionId: utilities.voidBytes32,
                        id: 0,
                        accounts: [accounts[0]],
                        amounts: [utilities.numberToString(9999*1e18)]
                    });
                }
                var transaction = await itemMainInterface.methods.createCollection(_collection, items).send(blockchainConnection.getSendingOptions());
                var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash)).logs;
                var collectionId = logs.filter(it => it.topics[0] === web3.utils.sha3('Collection(address,address,bytes32)'))[0].topics[3];
                var itemIds = logs.filter(it => it.topics[0] === web3.utils.sha3('CollectionItem(bytes32,bytes32,uint256)')).map(it => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

                _collection.id = collectionId;
                await Promise.all(itemIds.map(async (itemId, i) => {
                    items[i].collectionId = collectionId;
                    items[i].id = itemId;
                    assert.equal(items[i].amounts[0], await itemMainInterface.methods.balanceOf(items[i].accounts[0], itemId).call())
                    assert.equal(items[i].amounts[0], await itemMainInterface.methods.totalSupply(itemId).call())
                }));
                _collection.items = items;
                return _collection;
            };

            var collections = await Promise.all([0].map((_, i) => createCollectionAndItems(i, 1)));

            var operators = collections.map(() => accounts[0]);
            var froms = collections.map(() => Math.random() < 0.5 ? utilities.voidEthereumAddress : accounts[0]);
            var tos = collections.map((_, i) => Math.random() < 0.5 && froms[i] !== utilities.voidEthereumAddress ? utilities.voidEthereumAddress : accounts[Math.floor(Math.random() * accounts.length)]);
            var itemIds = collections.map(() => {
                var randomCollection = collections[Math.floor(Math.random() * collections.length)];
                return randomCollection.items[Math.floor(Math.random() * randomCollection.items.length)].id;
            });
            var values = collections.map(() => utilities.numberToString(Math.random() * 1e18).split('.')[0]); 

            var encodedParams = web3.eth.abi.encodeParameters(["address[]", "address[]", "address[]", "uint256[]", "uint256[]"], [operators, froms, tos, itemIds, values]);
            var { balances : expectedBalances, totalSupplies : expectedTotalSupplies } = await checkBalances(froms, itemIds);

            itemIds.forEach((_, i) => {
                froms[i] !== tos[i] && froms[i] === utilities.voidEthereumAddress && expectedBalances[i][0].add(values[i]);
                froms[i] !== tos[i] && tos[i] === utilities.voidEthereumAddress && expectedBalances[i][0].sub(values[i]);
                froms[i] === utilities.voidEthereumAddress && expectedTotalSupplies[i][0].add(values[i]);
                tos[i] === utilities.voidEthereumAddress && expectedTotalSupplies[i][0].sub(values[i]);
            });

            encodedParams = web3.eth.abi.encodeParameters(["bool", "bytes"], [false, encodedParams]);

            await itemMainInterface.methods.mintTransferOrBurn(true, encodedParams).send(blockchainConnection.getSendingOptions());

            await checkBalances(froms, itemIds, expectedBalances, expectedTotalSupplies);
        });
    });
});
