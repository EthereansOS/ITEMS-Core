var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");
const blockchainConnection = require("../util/blockchainConnection");
var erc20Contract;

describe("itemv2 ERC721DeckWrapper", () => {
    var blockToSkip = 30;
    var wrapper;
    var MainInterface;
    var mainInterface;
    var ItemInteroperableInterface;
    var itemInteroperableInterface;
    var itemInteroperableInterfaceAddress;
    var itemsList = [];
    var approvedHost = [];
    var exec651 = false;
    var exec652 = false;

    async function approveHost(holder) {
        if (!approvedHost.includes(holder)) {
            await blockchainConnection.unlockAccounts(holder);
            approvedHost.push(holder);
        }
    }

    async function asInteroperableInterface(itemId) {
        var c = new web3.eth.Contract(
            ItemInteroperableInterface.abi,
            await mainInterface.methods.interoperableOf(itemId).call()
        );
        try {
            await blockchainConnection.unlockAccounts(c.options.address);
        } catch (e) {}
        return c;
    }

    async function getEvents(eventName, tx) {
        var blockNumber =
        tx.blockNumber ||
         (
             await web3.eth.getTransactionReceipt(
                tx.transactionHash || tx
             )
         ).blockNumber;
        const events = await wrapper.getPastEvents(
            eventName,
            { fromBlock: blockNumber, toBlock: blockNumber }
        );

        return events;
    };

    async function getIdAndAddressFromEvents(tx){
        var events = await getEvents("Token", tx);
        var id = events.map((ev, index) => {
            return ev.returnValues.tokenId;
        });
        var address = events.map((ev, index) => {
            return ev.returnValues.tokenAddress;
        });
        return {id, address};
    }

    before(async () => {
        ItemInteroperableInterface = await compile(
            "impl/ItemInteroperableInterface"
        );
        itemInteroperableInterface = await new web3.eth.Contract(
            ItemInteroperableInterface.abi
        )
            .deploy({ data: ItemInteroperableInterface.bin })
            .send(blockchainConnection.getSendingOptions());
        itemInteroperableInterfaceAddress =
            itemInteroperableInterface.options.address;

        var NFTDynamicUriRenderer = await compile("util/NFTDynamicUriRenderer");
        var nftDynamicUriRenderer = await new web3.eth.Contract(
            NFTDynamicUriRenderer.abi
        )
            .deploy({
                data: NFTDynamicUriRenderer.bin,
                arguments: [utilities.voidEthereumAddress, "myUri"],
            })
            .send(blockchainConnection.getSendingOptions());

        var uri = web3.eth.abi.encodeParameters(
            ["address", "bytes"],
            [nftDynamicUriRenderer.options.address, "0x"]
        );

        var headerCollection = {
            host: accounts[1],
            name: "Colection1",
            symbol: "C1",
            uri,
        };

        var items = [];

        var deployParam = abi.encode(
            [
                "bytes32",
                "tuple(address,string,string,string)",
                "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
                "bytes",
            ],
            [
                utilities.voidBytes32,
                await itemsv2.convertHeader(headerCollection),
                items,
                "0x",
            ]
        );

        deployParam = abi.encode(
            ["address", "bytes"],
            [accounts[1], deployParam]
        );

        var ERC721Wrapper = await compile(
            "projection/ERC721Deck/ERC721DeckWrapper"
        );
        var wrapperData = await new web3.eth.Contract(ERC721Wrapper.abi)
            .deploy({ data: ERC721Wrapper.bin, arguments: ["0x"] })
            .encodeABI();

        mainInterface = await itemsv2.getMainInterface();

        var blockNumber = abi.encode(["uint256"], [blockToSkip]);

        var data = await itemsv2.createCollection(
            headerCollection.host,
            items,
            wrapperData,
            blockNumber,
            headerCollection
        );

        wrapper = new web3.eth.Contract(
            ERC721Wrapper.abi,
            data.projection.options.address
        );

        console.log("Wrapper Uri", await wrapper.methods.uri().call());
        assert.equal(
            await wrapper.methods.uri().call(),
            await mainInterface.methods
                .collectionUri(await wrapper.methods.collectionId().call())
                .call()
        );
    });

    it("#1", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_BA_1_1.1           Wrap              Bored Ape        Acc1        Acc1               3          A,B, C               yes, yes, no
         * #W_GODS_1_1.2         Wrap              Gods             Acc2        Acc2               1          D                    no
         * #W_GODS_1_1.3         Wrap              Gods             Acc2        Acc3               1          E                    yes
         *
         * #UWB_DBA_1_1.4        MF: Unwrap batch  DBA              Acc1        Acc3               1.51       A, B                 yes, yes
         * #UW_DBA_1_1.5         MF: Unwrap        DBA              Acc1        Acc3               0.51       A                    yes
         * #UW_DBA_1_1.6         MF: Unwrap        DBA              Acc1        Acc3               0.51       C                    yes
         * #UWB_DGODS_1_1.7      Unwrap Batch      DGods            Acc1        Acc4               3          A,B,C                yes, yes, no
         * #UW_DGODS_1_1.8       MF: Unwrap        DGods            Acc3        Acc3               1          E                    yes
         * #UW_DGODS_1_1.9       Unwrap            DGods            Acc2        Acc3               1          D                    no
         * JumpToBlock ---------------------------------------------------------------------------------------------------------------------------
         * #UW_DGods_1_2.1       Unwrap            DGods            Acc3        Acc2               1          E                    yes
         */

        var tokenHolderBoredApe = "0x1b523DC90A79cF5ee5d095825e586e33780f7188";

        var boredApeTokenAddresss =
            "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";

        var boredApeTokenId = ["1630", "6724", "4428"];

        var boredApe = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            boredApeTokenAddresss
        );

        await approveHost(tokenHolderBoredApe);

        await Promise.all(
            boredApeTokenId.map(async (id, index) => {
                await boredApe.methods
                    .safeTransferFrom(tokenHolderBoredApe, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderBoredApe,
                        })
                    );
            })
        );

        await Promise.all(
            boredApeTokenId.map(async (id, index) => {
                await boredApe.methods
                    .approve(wrapper.options.address, id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[1],
                        })
                    );
            })
        );

        var createItem = await wrapperResource.generateCreateItem(
            boredApeTokenId,
            [accounts[1], accounts[1], accounts[1]],
            [
                boredApeTokenAddresss,
                boredApeTokenAddresss,
                boredApeTokenAddresss,
            ],
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]
        );

        // #W_BA_1_1.1 START

        var lock = [true, true, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var boredApeItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkReserveData(
            tx,
            accounts[1],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        assert.equal(
            await wrapper.methods.source(boredApeItemIds[0]).call(),
            web3.utils.toChecksumAddress(boredApeTokenAddresss)
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "3",
            boredApe,
            boredApeTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "3000000000000000000",
            boredApeItemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "3000000000000000000",
            boredApeItemIds[2],
            wrapper
        );

        // #W_BA_1_1.1 END

        var headerCollection = {
            host: accounts[1],
            name: "newCollection",
            symbol: "newC1",
            uri: "newUriC1",
        };

        await catchCall(
            wrapper.methods.setHeader(headerCollection).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            ),
            "unauthorized"
        );

        await wrapper.methods
            .setHeader(headerCollection)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );
        headerCollection.host = wrapper.options.address;
        await itemProjection.assertCheckHeader(
            headerCollection,
            mainInterface.methods
                .collection(await wrapper.methods.collectionId().call())
                .call()
        );

        await catchCall(
            wrapper.methods
                .setItemsCollection(
                    boredApeItemIds,
                    Array(boredApeItemIds.length).fill(
                        await wrapper.methods.collectionId().call()
                    )
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Impossibru"
        );

        var tokenHolder = "0x7891f796a5d43466fC29F102069092aEF497a290";

        var godsTokenAddresss = "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07";

        var godsTokenId = ["81046035", "81046037"];

        var gods = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            godsTokenAddresss
        );

        await approveHost(tokenHolder);

        await Promise.all(
            godsTokenId.map(async (id, index) => {
                await gods.methods
                    .safeTransferFrom(tokenHolder, accounts[2], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolder,
                        })
                    );
            })
        );

        await gods.methods
            .approve(wrapper.options.address, godsTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [godsTokenId[0]],
            [accounts[2]],
            [godsTokenAddresss],
            ["1000000000000000000"]
        );

        // #W_GODS_1_1.2 START

        var tx = await wrapper.methods
            .mintItems(createItem)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var godsItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            gods,
            [godsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_1_1.2 END

        // #W_GODS_1_1.3 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1000000000000000000"], [accounts[3]], true]
        );

        tx = await gods.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                godsTokenId[1],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            gods,
            [godsTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_1_1.3 END

        // #UWB_DBA_1_1.4 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[1],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [boredApeItemIds[0], boredApeItemIds[1]],
                    ["1000000000000000000", "510000000000000000"],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Invalid amount"
        );

        // #UWB_DBA_1_1.4 END

        // #UW_DBA_1_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    boredApeItemIds[2],
                    "510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DBA_1_1.5 END

        // #UW_DBA_1_1.6 START

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[2],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    boredApeItemIds[2],
                    "510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DBA_1_1.6 END

        // #UWB_DGODS_1_1.7 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[1],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[2],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await wrapper.methods
            .burnBatch(
                accounts[1],
                [boredApeItemIds[0], boredApeItemIds[1], boredApeItemIds[2]],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[4],
            "3",
            boredApe,
            [boredApeTokenId[0], boredApeTokenId[1], boredApeTokenId[2]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-3000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-3000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UWB_DGODS_1_1.7 END

        // #UW_DGODS_1_1.8 START

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[1], accounts[3], "0x", false, false]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], godsItemIds[0], "1000000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DGODS_1_1.8 END

        // #UW_DGODS_1_1.9 START

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[3], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[2], godsItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            gods,
            [godsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await blockchainConnection.fastForward(blockToSkip);

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[1], accounts[2], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], godsItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            gods,
            [godsTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #UW_DGods_1_2.1 END
    });

    it("#2", async () => {
        /**
         * Label            ||   Operation                                   || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_ENS_2_1.1          MF: Wrap (passing empty tokenAddress)          ENS              Acc1        Acc1,Acc3          2          A,B                  yes,no
         * #W_ENS_2_1.2          MF: Wrap (passing empty tokenId)               ENS              Acc1        Acc1,Acc3          2          A,B                  yes,no
         * #W_ENS_2_1.3          Wrap                                           ENS              Acc1        Acc1,Acc3          2          A,B                  yes,no
         * #W_UNI_2_1.4          Wrap                                           UNI v3           Acc3        Acc3               2          C, D                 yes, no
         * #W_UNI_2_1.5          Wrap                                           UNI v3           Acc3        Acc1               1          E                    no
         *
         * #UWB_DENS_DUNI_2_1.6  MF: Unwrap batch                               DENS, DUNI       Acc1        Acc2               1+1        A, C                 yes, yes
         * #UWB_DENS_DUNI_2_1.7  MF: Unwrap batch                               DENS, DUNI       Acc3        Acc3               1+1        A, E                 yes, no
         * #UWB_DENS_DUNI_2_1.8  MF: Unwrap batch(passing wrong tokenId)        DENS, DUNI       Acc1        Acc2               1+1        A, C                 yes, yes
         * #UWB_DENS_DUNI_2_1.9  MF: Unwrap batch(passing wrong tokenAddress)   DENS, DUNI       Acc1        Acc2               1+1        A, C                 yes, yes
         * #UWB_DENS_DUNI_2_2.1  Unwrap Batch                                   DENS, DUNI       Acc1        Acc2               1+1        B,E                  yes, no
         * JumpToBlock ---------------------------------------------------------------------------------------------------------------------------
         * #UWB_DENS_DUNI_2_2.2  MF: Unwrap batch                               DENS, DUNI       Acc3        Acc3           0.51+0.51+1    A,C,D                yes, yes, no
         * #UWB_DENS_DUNI_2_2.3  Unwrap Batch                                   DENS, DUNI       Acc3        Acc3           0.51+1+0.51    A,C,D                yes, yes, no
         * #W_ENS_UNI_2_2.4      Wrap                                           ENS, UNI         Acc3        Acc3            1+1           A+, C+               no, no
         */

        var tokenHolderENS = "0xcfB586d08633fC36953be8083B63a7d96D50265B";

        var ENSTokenAddresss = "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85";

        var ENSTokenId = [
            "76209759912004573400534475157126407931116638124477574818832130517944945631566",
            "101180787059894841371179306178306111501534425305686398917862181098735580637363",
        ];

        var ens = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            ENSTokenAddresss
        );

        await approveHost(tokenHolderENS);

        await Promise.all(
            ENSTokenId.map(async (id, index) => {
                await ens.methods
                    .safeTransferFrom(tokenHolderENS, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderENS,
                        })
                    );

                await ens.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                );
            })
        );

        // #W_ENS_2_1.1 START
        var createItem = await wrapperResource.generateCreateItem(
            ENSTokenId,
            [accounts[1], accounts[3]],
            [utilities.voidEthereumAddress, utilities.voidEthereumAddress],
            ["1000000000000000000", "1000000000000000000"]
        );

        var lock = [true, false];

        await catchCall(
            wrapper.methods.mintItems(createItem, lock).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            " "
        );
        // #W_ENS_2_1.1 END

        // #W_ENS_2_1.2 START
        var createItem = await wrapperResource.generateCreateItem(
            [0],
            [accounts[1]],
            [ENSTokenAddresss],
            ["1000000000000000000"]
        );

        var lock = [true];

        await catchCall(
            wrapper.methods.mintItems(createItem, lock).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            " "
        );
        // #W_ENS_2_1.2 END

        // #W_ENS_2_1.3 START
        var createItem = await wrapperResource.generateCreateItem(
            ENSTokenId,
            [accounts[1], accounts[3]],
            [ENSTokenAddresss, ENSTokenAddresss],
            ["1000000000000000000", "1000000000000000000"]
        );

        var lock = [true, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var ENSItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkReserveData(
            tx,
            accounts[1],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        assert.equal(
            await wrapper.methods.source(ENSItemIds[0]).call(),
            web3.utils.toChecksumAddress(ENSTokenAddresss)
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            ens,
            ENSTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "1000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        // #W_ENS_2_1.3 END

        var tokenHolderUni = "0x6dd91bdab368282dc4ea4f4befc831b78a7c38c0";

        var uniTokenAddresss = "0xc36442b4a4522e871399cd717abdd847ab11fe88";

        var uniTokenId = ["179846", "179826", "179819"];

        var uni = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            uniTokenAddresss
        );

        await approveHost(tokenHolderUni);

        await Promise.all(
            uniTokenId.map(async (id, index) => {
                await uni.methods
                    .safeTransferFrom(tokenHolderUni, accounts[3], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderUni,
                        })
                    );
            })
        );

        // #W_UNI_2_1.4 START

        await Promise.all(
            uniTokenId.map(async (id, index) => {
                await uni.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                );
            })
        );

        var createItem = await wrapperResource.generateCreateItem(
            [uniTokenId[0], uniTokenId[1]],
            [accounts[3], accounts[3]],
            [uniTokenAddresss, uniTokenAddresss],
            ["1000000000000000000", "1000000000000000000"]
        );

        var lock = [true, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var uniItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkReserveData(
            tx,
            accounts[3],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        assert.equal(
            await wrapper.methods.source(uniItemIds[0]).call(),
            web3.utils.toChecksumAddress(uniTokenAddresss)
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "2",
            uni,
            [uniTokenId[0], uniTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            uniItemIds[0],
            wrapper
        );

        // #W_UNI_2_1.4 END

        // #W_UNI_2_1.5 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1000000000000000000"], [accounts[1]], false]
        );

        tx = await uni.methods
            .safeTransferFrom(
                accounts[3],
                wrapper.options.address,
                uniTokenId[2],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "1",
            uni,
            [uniTokenId[2]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "1000000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            uniItemIds[0],
            wrapper
        );

        // #W_UNI_2_1.5 END

        // #UWB_DENS_DUNI_2_1.6 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, ENSTokenId[0], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[0], accounts[2], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [ENSItemIds[0], uniItemIds[0]],
                    ["1000000000000000000", "1000000000000000000"],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Cannot unlock"
        );

        // #UWB_DENS_DUNI_2_1.6 END

        // #UWB_DENS_DUNI_2_1.7 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, ENSTokenId[0], accounts[3], "0x", false, false]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[2], accounts[3], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [ENSItemIds[0], uniItemIds[0]],
                    ["1000000000000000000", "1000000000000000000"],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Cannot unlock"
        );

        // #UWB_DENS_DUNI_2_1.7 END

        // #UWB_DENS_DUNI_2_1.8 START
        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, uniTokenId[2], accounts[2], "0x", false, false]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, ENSTokenId[1], accounts[2], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [ENSItemIds[0], uniItemIds[0]],
                    ["1000000000000000000", "1000000000000000000"],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            " "
        );
        // #UWB_DENS_DUNI_2_1.8 END

        // #UWB_DENS_DUNI_2_1.9 END
        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, ENSTokenId[1], accounts[2], "0x", false, false]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, uniTokenId[2], accounts[2], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [ENSItemIds[0], uniItemIds[0]],
                    ["1000000000000000000", "1000000000000000000"],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Wrong ERC721"
        );
        // #UWB_DENS_DUNI_2_1.9 END

        // #UWB_DENS_DUNI_2_2.1 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, ENSTokenId[1], accounts[2], "0x", false, false]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[2], accounts[2], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [ENSItemIds[0], uniItemIds[0]],
                ["1000000000000000000", "1000000000000000000"],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            uni,
            [uniTokenId[2]]
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            ens,
            [ENSTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-1000000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-1000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            ENSItemIds[0],
            wrapper
        );

        // #UWB_DENS_DUNI_2_2.1 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UWB_DENS_DUNI_2_2.2 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [ENSTokenAddresss, ENSTokenId[0], accounts[3], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[0], accounts[3], "0x", false, false]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [uniTokenAddresss, uniTokenId[1], accounts[3], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [ENSItemIds[0], uniItemIds[0], uniItemIds[0]],
                    [
                        "510000000000000000",
                        "510000000000000000",
                        "1000000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UWB_DENS_DUNI_2_2.2 END

        // #UWB_DENS_DUNI_2_2.3 START

        await wrapper.methods
            .burnBatch(
                accounts[3],
                [ENSItemIds[0], uniItemIds[0], uniItemIds[0]],
                [
                    "510000000000000000",
                    "1000000000000000000",
                    "510000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        // #UWB_DENS_DUNI_2_2.3 END

        // #W_ENS_UNI_2_2.4 START

        await uni.methods.approve(wrapper.options.address, uniTokenId[0]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[3],
            })
        );

        await ens.methods.approve(wrapper.options.address, ENSTokenId[0]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[3],
            })
        );

        var createWrongItem = await wrapperResource.generateCreateItem(
            [ENSTokenId[0], uniTokenId[0]],
            [accounts[3], accounts[3]],
            [ENSTokenAddresss, uniTokenAddresss],
            ["710000000000000000", "710000000000000000"]
        );

        await catchCall(
            wrapper.methods.mintItems(createWrongItem, [false, false]).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            ),
            "amount"
        );

        var createWrongItem = await wrapperResource.generateCreateItem(
            [ENSTokenId[0], uniTokenId[0]],
            [accounts[3], accounts[3]],
            [ENSTokenAddresss, uniTokenAddresss],
            ["410000000000000000", "410000000000000000"]
        );

        await catchCall(
            wrapper.methods.mintItems(createWrongItem, [false, false]).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            ),
            "amount"
        );

        var createItem = await wrapperResource.generateCreateItem(
            [ENSTokenId[0], uniTokenId[0]],
            [accounts[3], accounts[3]],
            [ENSTokenAddresss, uniTokenAddresss],
            ["510000000000000000", "510000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false, false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "1",
            ens,
            [ENSTokenId[0]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "1",
            uni,
            [uniTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "510000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "510000000000000000",
            ENSItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "510000000000000000",
            uniItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "510000000000000000",
            ENSItemIds[0],
            wrapper
        );

        // #W_ENS_UNI_2_2.4 END
    });

    it("#3", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_GODS_3_1.1          Wrap              GODS            Acc3        Acc3              2            A,B                  yes,yes
         * #W_BA_3_1.2            Wrap              BORED APE       Acc4        Acc4              1            C                    no
         * #W_BA_3_1.3            Wrap              BORED APE       Acc4        Acc4              1            D                    yes
         *
         * #UW_DGODS_3_1.4        MF: Unwrap        DGODS           Acc3        Acc3              0.51         A                    yes
         * #BRN_DGODS_3_1.5       Burn(Interop.)    DGODS           Acc3        //                0.8          //                   //
         * #UW_DGODS_3_1.6        MF: Unwrap        DGODS           Acc3        Acc3              0.6          A                    yes
         * #UW_DGODS_3_1.7        Unwrap            DGODS           Acc3        Acc3              1            A                    yes
         * #W_GODS_3_1.8          Wrap              GODS            Acc3        Acc3              1            A+                   no
         * #UW_DGODS_3_1.9        Unwrap            DGODS           Acc3        Acc3              0.6          A+                   no
         * #UW_DGODS_3_2.1        MF: Unwrap        DGODS           Acc3        Acc3              0.4          B                    yes
         * #W_GODS_3_2.2          Wrap              GODS            Acc2        Acc3              1            A++                  no
         * #UW_DGODS_3_2.3        Unwrap            DGODS           Acc3        Acc3              0.51         B                    yes
         * #UW_DBA_3_2.4          MF: Unwrap        DBA             Acc3        Acc3              0.6          C                    no
         * #BRN_DBA_3_2.5         Burn(Interop.)    DBA             Acc4        //                1.4          //                   //
         * #UW_DBA_3_2.6          Unwrap            DBA             Acc4        Acc3              0.6          C                    no
         * #W_BA_3_2.7            Wrap              BORED APE       Acc4        Acc4              1            C+                   no
         * #UW_DBA_3_2.8          Unwrap            DBA             Acc4        Acc4              0.6          D                    yes
         * #W_BA_3_2.9            Wrap              BORED APE       Acc4        Acc5              1            D+                   no
         * #UW_DBA_3_3.1          Unwrap            DBA             Acc5        Acc4              0.6          D+                   no
         * #BRN_DBA_3_3.2         Burn(Interop.)    DBA             Acc4        //                0.4          //                   //
         * #BRN_DGODS_3_3.3       Burn(Interop.)    DGODS           Acc3        //                0.49         //                   //
         */

        var tokenHolderGods = "0x7891f796a5d43466fC29F102069092aEF497a290";

        var godsTokenAddresss = "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07";

        var godsTokenId = ["83257853", "83257854"];

        var gods = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            godsTokenAddresss
        );

        await approveHost(tokenHolderGods);

        await Promise.all(
            godsTokenId.map(async (id, index) => {
                await gods.methods
                    .safeTransferFrom(tokenHolderGods, accounts[3], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderGods,
                        })
                    );
                await gods.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                );
            })
        );

        // #W_GODS_3_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            godsTokenId,
            [accounts[3], accounts[3]],
            [godsTokenAddresss, godsTokenAddresss],
            ["1000000000000000000", "1000000000000000000"]
        );

        var lock = [true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var godsItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkReserveData(
            tx,
            accounts[3],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        assert.equal(
            await wrapper.methods.source(godsItemIds[0]).call(),
            web3.utils.toChecksumAddress(godsTokenAddresss)
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "2",
            gods,
            godsTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_3_1.1 END

        var tokenHolderBoredApe = "0x1b523DC90A79cF5ee5d095825e586e33780f7188";

        var boredApeTokenAddresss =
            "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";

        var boredApeTokenId = ["8188", "8187"];

        var boredApe = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            boredApeTokenAddresss
        );

        await approveHost(tokenHolderBoredApe);

        await Promise.all(
            boredApeTokenId.map(async (id, index) => {
                await boredApe.methods
                    .safeTransferFrom(tokenHolderBoredApe, accounts[4], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderBoredApe,
                        })
                    );

                await boredApe.methods
                    .approve(wrapper.options.address, id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[4],
                        })
                    );
            })
        );

        // #W_BA_3_1.2 START

        var createItem = await wrapperResource.generateCreateItem(
            [boredApeTokenId[0]],
            [accounts[4]],
            [boredApeTokenAddresss],
            ["1000000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var boredApeItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[4],
            wrapper.options.address,
            "1",
            boredApe,
            [boredApeTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_3_1.2 END

        // #W_BA_3_1.3 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["600000000000000000", "400000000000000000"], [accounts[4], accounts[4]], true]
        );

        tx = await boredApe.methods
            .safeTransferFrom(
                accounts[4],
                wrapper.options.address,
                boredApeTokenId[1],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[4],
            wrapper.options.address,
            "1",
            boredApe,
            [boredApeTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_3_1.3 END

        // #UW_DGODS_3_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[3], "0x", false, false]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], godsItemIds[0], "510000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DGODS_3_1.4 END

        // #BRN_DGODS_3_1.5 START

        var burnValue = "800000000000000000";

        erc20Contract = await asInteroperableInterface(godsItemIds[0]);
        await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            godsItemIds[0],
            wrapper
        );

        // #BRN_DGODS_3_1.5 END

        // #UW_DGODS_3_1.6 START
        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[3], "0x", false, false]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], godsItemIds[0], "600000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );
        // #BRN_DGODS_3_1.6 END

        // #UW_DGODS_3_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[3], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], godsItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            gods,
            [godsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #UW_DGODS_3_1.7 END

        // #W_GODS_3_1.8 START

        await gods.methods
            .approve(wrapper.options.address, godsTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [godsTokenId[0]],
            [accounts[3]],
            [godsTokenAddresss],
            ["800000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[3],
            wrapper.options.address,
            "1",
            gods,
            [godsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "800000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "800000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_3_1.8 END

        // #UW_DGODS_3_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[2], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], godsItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            gods,
            [godsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-600000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-600000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #UW_DGODS_3_1.9 END

        // #UW_DGODS_3_2.1 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[1], accounts[3], "0x", false, false]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], godsItemIds[0], "400000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DGODS_3_2.1 END

        // #W_GODS_3_2.2 START

        await gods.methods
            .approve(wrapper.options.address, godsTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await catchCall(wrapper.methods
            .mintItems(await wrapperResource.generateCreateItem(
                [godsTokenId[0]],
                [accounts[3]],
                [godsTokenAddresss],
                ["700000000000000000"]
            ), [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            ), "amount");

        var createItem = await wrapperResource.generateCreateItem(
            [godsTokenId[0]],
            [accounts[3]],
            [godsTokenAddresss],
            ["600000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            gods,
            [godsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "600000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "600000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #W_GODS_3_2.2 END

        // #UW_DGODS_3_2.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[1], accounts[3], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], godsItemIds[0], "510000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            gods,
            [godsTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-510000000000000000",
            godsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-510000000000000000",
            godsItemIds[0],
            wrapper
        );

        // #UW_DGODS_3_2.3 END

        // #UW_DBA_3_2.4 START
        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[4],
                    boredApeItemIds[0],
                    "600000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[4],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DBA_3_2.4 END

        // #BRN_DBA_3_2.5 START

        var burnValue = "1400000000000000000";

        erc20Contract = await asInteroperableInterface(boredApeItemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            boredApeItemIds[0],
            wrapper
        );

        // #BRN_DBA_3_2.5 END

        // #UW_DBA_3_2.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[4], boredApeItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[4],
            "1",
            boredApe,
            [boredApeTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UW_DBA_3_2.6 END

        // #W_BA_3_2.7 START

        await boredApe.methods
            .approve(wrapper.options.address, boredApeTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [boredApeTokenId[0]],
            [accounts[4]],
            [boredApeTokenAddresss],
            ["1000000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[4],
            wrapper.options.address,
            "1",
            boredApe,
            [boredApeTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_3_2.7 END

        // #UW_DBA_3_2.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[1],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[4], boredApeItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[4],
            "1",
            boredApe,
            [boredApeTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UW_DBA_3_2.8 END

        // #W_BA_3_2.9 START

        await boredApe.methods
            .approve(wrapper.options.address, boredApeTokenId[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        var createItem = await wrapperResource.generateCreateItem(
            [boredApeTokenId[1]],
            [accounts[5]],
            [boredApeTokenAddresss],
            ["600000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[4],
            wrapper.options.address,
            "1",
            boredApe,
            [boredApeTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[5],
            "600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_3_2.9 END

        // #UW_DBA_3_3.1 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[1],
                accounts[4],
                "0x",
                false,
                false,
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[5], boredApeItemIds[0], "600000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[5],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[4],
            "1",
            boredApe,
            [boredApeTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[5],
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-600000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UW_DBA_3_3.1 END

        // #BRN_DBA_3_3.2 START
        var burnValue = "400000000000000000";

        erc20Contract = await asInteroperableInterface(boredApeItemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            boredApeItemIds[0],
            wrapper
        );
        // #BRN_DBA_3_3.2 END

        // #BRN_DGODS_3_3.3 START
        var burnValue = "490000000000000000";

        erc20Contract = await asInteroperableInterface(godsItemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            godsItemIds[0],
            wrapper
        );
        // #BRN_DGODS_3_3.3 END

    });

    it("#4", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_CS_4_1.1           Wrap              Crypto Skulls    Acc1        Acc1               1          A                    no
         *
         * #TRA_DCS_4_1.2        Transfer          DCS              Acc1        Acc2               1          //                   //
         * #UW_DCS_4_1.3         Unwrap            DCS              Acc2        Acc2               0.55       A                    no
         * #W_CS_4_1.4           Wrap              CS               Acc2        Acc1               1          A+                   yes
         * #UW_DCS_4_1.5         MF: Unwrap        DCS              Acc1        Acc2               1          A+                   yes
         * JumpToBlock ---------------------------------------------------------------------------------------------------------------------------
         * #UW_DCS_4_1.6         Unwrap            DCS              Acc1        Acc2               0.55       A+                   yes
         */
        var tokenHolderCryptoSkulls =
            "0x9aaf2f84afb2162a1efa57018bd4b1ae0da28cce";

        var cryptoSkullsTokenAddresss =
            "0xc1caf0c19a8ac28c41fe59ba6c754e4b9bd54de9";

        var cryptoSkullsTokenId = ["2344"];

        var cryptoSkulls = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            cryptoSkullsTokenAddresss
        );

        await approveHost(tokenHolderCryptoSkulls);

        await Promise.all(
            cryptoSkullsTokenId.map(async (id, index) => {
                await cryptoSkulls.methods
                    .safeTransferFrom(tokenHolderCryptoSkulls, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderCryptoSkulls,
                        })
                    );

                await cryptoSkulls.methods
                    .approve(wrapper.options.address, id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[1],
                        })
                    );
            })
        );

        // #W_CS_4_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            cryptoSkullsTokenId,
            [accounts[1]],
            [cryptoSkullsTokenAddresss],
            ["1000000000000000000"]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var cryptoSkullsItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "1",
            cryptoSkulls,
            cryptoSkullsTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "1000000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        // #W_CS_4_1.1 END

        // #TRA_DCS_4_1.2 START

        var tx = await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                cryptoSkullsItemIds[0],
                "1000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        // #TRA_DCS_4_1.2 END

        // #UW_DCS_4_1.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                cryptoSkullsTokenAddresss,
                cryptoSkullsTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "550000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[2], cryptoSkullsItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            cryptoSkulls,
            [cryptoSkullsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToUnwrap.mul(-1),
            cryptoSkullsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            cryptoSkullsItemIds[0],
            wrapper
        );

        // #UW_DCS_4_1.3 END

        // #W_CS_4_1.4 START

        await cryptoSkulls.methods
            .approve(wrapper.options.address, cryptoSkullsTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["550000000000000000"], [accounts[1]], true]
        );

        tx = await cryptoSkulls.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                cryptoSkullsTokenId[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            cryptoSkulls,
            cryptoSkullsTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "550000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "550000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        // #W_CS_4_1.4 END

        // #UW_DCS_4_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                cryptoSkullsTokenAddresss,
                cryptoSkullsTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    cryptoSkullsItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DCS_4_1.5 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DCS_4_1.6 START

        var tx = await wrapper.methods
            .burn(
                accounts[1],
                cryptoSkullsItemIds[0],
                "550000000000000000",
                data
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            cryptoSkulls,
            [cryptoSkullsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-550000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-550000000000000000",
            cryptoSkullsItemIds[0],
            wrapper
        );

        // #UW_DCS_4_1.6 END
    });

    it("#5", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_EP_5_1.1           Wrap              Ether Pirates    Acc1        Acc1               1          A                    yes
         *
         * #UW_DEP_5_1.2         Unwrap            DEP              Acc1        Acc2               0.6        A                    yes
         * #W_EP_5_1.3           Wrap              Ether Pirates    Acc2        Acc1               1          A+                   no
         * #UW_DEP_5_1.4         Unwrap            DEP              Acc1        Acc2               0.7        A+                   no
         */

        var tokenHolderEtherPirates =
            "0x43cf525d63987d17052d9891587bcfb9592c3ee2";

        var etherPiratesTokenAddresss =
            "0x62365089075e3fc959952134c283e0375b49f648";

        var etherPiratesTokenId = ["3456"];

        var etherPirates = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            etherPiratesTokenAddresss
        );

        await approveHost(tokenHolderEtherPirates);

        await Promise.all(
            etherPiratesTokenId.map(async (id, index) => {
                await etherPirates.methods
                    .safeTransferFrom(tokenHolderEtherPirates, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderEtherPirates,
                        })
                    );

                await etherPirates.methods
                    .approve(wrapper.options.address, id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[1],
                        })
                    );
            })
        );

        // #W_EP_5_1.1 START

        var amountToWrap = "1000000000000000000";

        var createItem = await wrapperResource.generateCreateItem(
            etherPiratesTokenId,
            [accounts[1]],
            [etherPiratesTokenAddresss],
            [amountToWrap]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var etherPiratesItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            etherPiratesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            etherPiratesItemIds[0],
            wrapper
        );

        // #W_EP_5_1.1 END

        // #UW_DEP_5_1.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                etherPiratesTokenAddresss,
                etherPiratesTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "600000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], etherPiratesItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            etherPiratesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            etherPiratesItemIds[0],
            wrapper
        );

        // #UW_DEP_5_1.2 END

        // #W_EP_5_1.3 START

        await etherPirates.methods
            .approve(wrapper.options.address, etherPiratesTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amountToWrap = "600000000000000000";

        var createItem = await wrapperResource.generateCreateItem(
            etherPiratesTokenId,
            [accounts[1]],
            [etherPiratesTokenAddresss],
            [amountToWrap]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            etherPiratesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            etherPiratesItemIds[0],
            wrapper
        );

        // #W_EP_5_1.3 END

        // #UW_DEP_5_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                etherPiratesTokenAddresss,
                etherPiratesTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "700000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], etherPiratesItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            etherPiratesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            etherPiratesItemIds[0],
            wrapper
        );

        // #UW_DEP_5_1.4 START
    });

    it("#5b", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_DOO_5b_1.1         Wrap              Doodle          Acc1        Acc1               1          A                    yes
         *
         * #UW_DDOO_5b_1.2       Unwrap            DDOO            Acc1        Acc2               0.6        A                    yes
         * #W_DOO_5b_1.3         Wrap              Doodle          Acc2        Acc1               1          A+                   no
         * #UW_DDOO_5b_1.4       Unwrap            DDOO            Acc1        Acc2               0.7        A+                   no
         */

        var tokenHolderDoodle = "0xc41a84d016b1391fa0f4048d37d3131988412360";

        var doodleTokenAddresss = "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e";

        var doodleTokenId = ["5505"];

        var doodle = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            doodleTokenAddresss
        );

        await approveHost(tokenHolderDoodle);

        await Promise.all(
            doodleTokenId.map(async (id, index) => {
                await doodle.methods
                    .safeTransferFrom(tokenHolderDoodle, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderDoodle,
                        })
                    );

                await doodle.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                );
            })
        );

        // #W_DOO_5b_1.1 START

        var amountToWrap = "1000000000000000000";

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap], [accounts[1]], true]
        );

        tx = await doodle.methods
            .safeTransferFrom(
                accounts[1],
                wrapper.options.address,
                doodleTokenId[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var doodleItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "1",
            doodle,
            doodleTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            doodleItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            doodleItemIds[0],
            wrapper
        );

        // #W_DOO_5b_1.1 END

        // #UW_DDOO_5b_1.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                doodleTokenAddresss,
                doodleTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "600000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], doodleItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            doodle,
            doodleTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            doodleItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            doodleItemIds[0],
            wrapper
        );

        // #UW_DDOO_5b_1.2 END

        // #W_DOO_5b_1.3 START

        await doodle.methods
            .approve(wrapper.options.address, doodleTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amountToWrap = "600000000000000000";

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap], [accounts[1]], false]
        );

        tx = await doodle.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                doodleTokenId[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            doodle,
            doodleTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            doodleItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            doodleItemIds[0],
            wrapper
        );

        // #W_DOO_5b_1.3 END

        // #UW_DDOO_5b_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                doodleTokenAddresss,
                doodleTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "700000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], doodleItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            doodle,
            doodleTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            doodleItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            doodleItemIds[0],
            wrapper
        );

        // #UW_DDOO_5b_1.4 START
    });

    it("#5c", async () => {
        /**
         * Label            ||   Operation      || Token         || From || Receiver address || amount    || Token Reference    || Lock
         * #W_CK_5_1.1           Wrap              Crypto Kitties   Acc1        Acc1               1          A                    yes
         *
         * #UW_DCK_5_1.2         Unwrap            DCK              Acc1        Acc2               0.6        A                    yes
         * #W_CK_5_1.3           Wrap              Crypto Kitties   Acc2        Acc1               1          A+                   no
         * #UW_DCK_5_1.4         Unwrap            DCK              Acc1        Acc2               0.7        A+                   no
         */

        var tokenHolderCryptokitties =
            "0x96236adb640ec620a85898378375cedf03ca21ff";

        var cryptokittiesTokenAddresss =
            "0x06012c8cf97BEaD5deAe237070F9587f8E7A266d";

        var cryptokittiesTokenId = ["1885653"];

        var cryptokitties = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            cryptokittiesTokenAddresss
        );

        await approveHost(tokenHolderCryptokitties);

        await Promise.all(
            cryptokittiesTokenId.map(async (id, index) => {
                await cryptokitties.methods
                    .approve(tokenHolderCryptokitties, id)
                    .send(blockchainConnection.getSendingOptions({ from: tokenHolderCryptokitties }));
                await cryptokitties.methods
                    .transferFrom(tokenHolderCryptokitties, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderCryptokitties,
                        })
                    );

                await cryptokitties.methods
                    .approve(wrapper.options.address, id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[1],
                        })
                    );
            })
        );

        // #W_CK_5_1.1 START

        var amountToWrap = "1000000000000000000";

        var createItem = await wrapperResource.generateCreateItem(
            cryptokittiesTokenId,
            [accounts[1]],
            [cryptokittiesTokenAddresss],
            [amountToWrap]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var cryptokittiesItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            cryptokittiesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            cryptokittiesItemIds[0],
            wrapper
        );

        // #W_CK_5_1.1 END

        // #UW_DCK_5_1.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                cryptokittiesTokenAddresss,
                cryptokittiesTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "600000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], cryptokittiesItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            cryptokittiesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            cryptokittiesItemIds[0],
            wrapper
        );

        // #UW_DCK_5_1.2 END

        // #W_CK_5_1.3 START

        await cryptokitties.methods
            .approve(wrapper.options.address, cryptokittiesTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amountToWrap = "600000000000000000";

        var createItem = await wrapperResource.generateCreateItem(
            cryptokittiesTokenId,
            [accounts[1]],
            [cryptokittiesTokenAddresss],
            [amountToWrap]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap,
            cryptokittiesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap,
            cryptokittiesItemIds[0],
            wrapper
        );

        // #W_CK_5_1.3 END

        // #UW_DCK_5_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                cryptokittiesTokenAddresss,
                cryptokittiesTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var amountToUnwrap = "700000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], cryptokittiesItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            cryptokittiesItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            cryptokittiesItemIds[0],
            wrapper
        );

        // #UW_DCK_5_1.4 START
    });

    it("#6", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address                  || amount               || Token Reference       || Lock
         * #W_VOX_SB_NFF_6_1.1       Wrap                VOX, Sandbox, Fungi    Acc1    Acc2, Acc3,Acc2, Acc3,Acc2, Acc3    1+1+1+1+1+1                 A, B, C, D, E, F      yes, no, yes, no, yes,no
         *
         * #UW_DVOX_DSB_DNFF_6_1.2   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc2        Acc2                            1+1+1                       A, C, E               yes, yes, yes
         * #UW_DVOX_DSB_DNFF_6_1.3   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc3        Acc3                            0.51+0.51+0.51              B,D,F                 no, no, no
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DVOX_DSB_DNFF_6_1.4   Unwrap Batch        DVOX,DSB,DNFF          Acc2        Acc2                            1+1+1                       A, C, E               yes, yes, yes
         * #W_VOX_SB_NFF_6_1.5       Wrap                VOX, Sandbox, Fungi    Acc2        Acc3                            1+1+1+1+1+1                 A+,C+,E+,G,H,I        yes, yes, yes,yes, yes, yes
         * #UW_DVOX_DSB_DNFF_6_1.6   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc3        Acc2                            1+1+1+1+1+1+1+1+1           A+,B,G,C+,D,H,E+,F,I  yes, no, yes, no, yes,no, yes, yes, yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DVOX_DSB_DNFF_6_1.7   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc3        Acc2                            1+0.51+1+1+1+0.51+1+1+0.51  A+,B,G,C+,D,H,E+,F,I  yes, no, yes, no, yes,no, yes, yes, yes
         * #UW_DVOX_DSB_DNFF_6_1.8   Unwrap Batch        DVOX,DSB,DNFF          Acc3        Acc2                            1+1+0.51+1+1+0.51+1+1+0.51  A+,B,G,C+,D,H,E+,F,I  yes, no, yes, no, yes,no, yes, yes, yes
         * #BRN_DVOX_6_1.9           Burn(Interop.)      DVOX                   Acc3        //                              0.49                        //                    //
         * #BRN_DSB_6_2.1            Burn(Interop.)      DVOX                   Acc3        //                              0.49                        //                    //
         * #BRN_DSB_6_2.2            Burn(Interop.)      DNFF                   Acc3        //                              0.49                        //                    //
         */

        var tokenHolderVox = "0xe995a353a97a33e2dbac9e70ba6778db86728f4e";

        var voxTokenAddresss = "0xad9fd7cb4fc7a0fbce08d64068f60cbde22ed34c";

        var voxTokenId = ["4160", "4161", "4162"];

        var vox = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            voxTokenAddresss
        );

        await approveHost(tokenHolderVox);

        await Promise.all(
            voxTokenId.map((id) =>
                vox.methods
                    .safeTransferFrom(tokenHolderVox, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderVox,
                        })
                    )
            )
        );

        await Promise.all(
            voxTokenId.map((id) =>
                vox.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                )
            )
        );

        var tokenHolderSandbox = "0x9cfA73B8d300Ec5Bf204e4de4A58e5ee6B7dC93C";

        var sandboxTokenAddresss = "0x50f5474724e0ee42d9a4e711ccfb275809fd6d4a";

        var sandboxTokenId = ["9432", "9433", "9434"];

        var sandbox = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            sandboxTokenAddresss
        );

        await approveHost(tokenHolderSandbox);

        await Promise.all(
            sandboxTokenId.map((id) =>
                sandbox.methods
                    .safeTransferFrom(tokenHolderSandbox, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderSandbox,
                        })
                    )
            )
        );

        await Promise.all(
            sandboxTokenId.map((id) =>
                sandbox.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                )
            )
        );

        var tokenHolderFunghi = "0x1d2c4cd9bee9dfe088430b95d274e765151c32db";

        var funghiTokenAddresss = "0x5f47079d0e45d95f5d5167a480b695883c4e47d9";

        var funghiTokenId = ["18", "97", "20"];

        var funghi = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            funghiTokenAddresss
        );

        await approveHost(tokenHolderFunghi);

        await Promise.all(
            funghiTokenId.map((id) =>
                funghi.methods
                    .safeTransferFrom(tokenHolderFunghi, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderFunghi,
                        })
                    )
            )
        );

        await Promise.all(
            funghiTokenId.map((id) =>
                funghi.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                )
            )
        );

        // #W_VOX_SB_NFF_6_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            [
                voxTokenId[0],
                voxTokenId[1],
                sandboxTokenId[0],
                sandboxTokenId[1],
                funghiTokenId[0],
                funghiTokenId[1],
            ],
            [
                accounts[2],
                accounts[3],
                accounts[2],
                accounts[3],
                accounts[2],
                accounts[3],
            ],
            [
                voxTokenAddresss,
                voxTokenAddresss,
                sandboxTokenAddresss,
                sandboxTokenAddresss,
                funghiTokenAddresss,
                funghiTokenAddresss,
            ],
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true, false, true, false, true, false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var itemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            vox,
            [voxTokenId[0], voxTokenId[1]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            sandbox,
            [sandboxTokenId[0], sandboxTokenId[1]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            funghi,
            [funghiTokenId[0], funghiTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[4],
            wrapper
        );

        // #W_VOX_SB_NFF_6_1.1 END

        // #UW_DVOX_DSB_DNFF_6_1.2 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[3], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[2],
                    [itemIds[0], itemIds[2], itemIds[4]],
                    [
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DVOX_DSB_DNFF_6_1.2 END

        // #UW_DVOX_DSB_DNFF_6_1.3 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[1], accounts[3], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[1],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[1],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [itemIds[0], itemIds[2], itemIds[4]],
                    [
                        "510000000000000000",
                        "510000000000000000",
                        "510000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DVOX_DSB_DNFF_6_1.3 END

        // JumpToBlock START
        await blockchainConnection.fastForward(blockToSkip);
        // JumpToBlock END

        // #UW_DVOX_DSB_DNFF_6_1.4 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var tx = await wrapper.methods
            .burnBatch(
                accounts[2],
                [itemIds[0], itemIds[2], itemIds[4]],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            vox,
            [voxTokenId[0]]
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            sandbox,
            [sandboxTokenId[0]]
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            funghi,
            [funghiTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            itemIds[4],
            wrapper
        );

        // #UW_DVOX_DSB_DNFF_6_1.4 END

        await sandbox.methods
            .safeTransferFrom(accounts[1], accounts[2], sandboxTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await vox.methods
            .safeTransferFrom(accounts[1], accounts[2], voxTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await funghi.methods
            .safeTransferFrom(accounts[1], accounts[2], funghiTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await funghi.methods
            .approve(wrapper.options.address, funghiTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await funghi.methods
            .approve(wrapper.options.address, funghiTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await vox.methods.approve(wrapper.options.address, voxTokenId[0]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[2],
            })
        );

        await vox.methods.approve(wrapper.options.address, voxTokenId[2]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[2],
            })
        );

        await sandbox.methods
            .approve(wrapper.options.address, sandboxTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await sandbox.methods
            .approve(wrapper.options.address, sandboxTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        // #W_VOX_SB_NFF_6_1.5 START

        var createItem = await wrapperResource.generateCreateItem(
            [
                voxTokenId[0],
                sandboxTokenId[0],
                funghiTokenId[0],
                voxTokenId[2],
                sandboxTokenId[2],
                funghiTokenId[2],
            ],
            [
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
            ],
            [
                voxTokenAddresss,
                sandboxTokenAddresss,
                funghiTokenAddresss,
                voxTokenAddresss,
                sandboxTokenAddresss,
                funghiTokenAddresss,
            ],
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true, true, true, true, true, true])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "2",
            vox,
            [voxTokenId[0], voxTokenId[2]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "2",
            sandbox,
            [sandboxTokenId[0], sandboxTokenId[2]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "2",
            funghi,
            [funghiTokenId[0], funghiTokenId[2]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[4],
            wrapper
        );

        // #W_VOX_SB_NFF_6_1.5 END

        // #UW_DVOX_DSB_DNFF_6_1.6 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[1], accounts[2], "0x", false, false]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[2], accounts[2], "0x", false, false]
        );
        datas[3] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[4] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[5] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[6] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[7] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[8] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [
                        itemIds[0],
                        itemIds[0],
                        itemIds[0],
                        itemIds[2],
                        itemIds[2],
                        itemIds[2],
                        itemIds[4],
                        itemIds[4],
                        itemIds[4],
                    ],
                    [
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DVOX_DSB_DNFF_6_1.6 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DVOX_DSB_DNFF_6_1.7 START

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [
                        itemIds[0],
                        itemIds[0],
                        itemIds[0],
                        itemIds[2],
                        itemIds[2],
                        itemIds[2],
                        itemIds[4],
                        itemIds[4],
                        itemIds[4],
                    ],
                    [
                        "1000000000000000000",
                        "510000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "510000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "510000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DVOX_DSB_DNFF_6_1.7 END

        // #UW_DVOX_DSB_DNFF_6_1.8 START

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [
                    itemIds[0],
                    itemIds[0],
                    itemIds[0],
                    itemIds[2],
                    itemIds[2],
                    itemIds[2],
                    itemIds[4],
                    itemIds[4],
                    itemIds[4],
                ],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                    "510000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                    "510000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                    "510000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "3",
            vox,
            voxTokenId
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "3",
            sandbox,
            sandboxTokenId
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "3",
            funghi,
            funghiTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-2510000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-2510000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-2510000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2510000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2510000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2510000000000000000",
            itemIds[4],
            wrapper
        );

        // #UW_DVOX_DSB_DNFF_6_1.8 END



        var burnValue = "490000000000000000";
        // #BRN_DVOX_6_1.9 START

        erc20Contract = await asInteroperableInterface(itemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );
        // #BRN_DVOX_6_1.9 END

        // #BRN_DSB_6_2.1 START
        erc20Contract = await asInteroperableInterface(itemIds[2]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );
        // #BRN_DSB_6_2.1 END

        // #BRN_DNFF_6_2.2 START
        erc20Contract = await asInteroperableInterface(itemIds[4]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );
        // #BRN_DNFF_6_2.2 END

    });

    it("#6b", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address                  || amount               || Token Reference       || Lock
         * #W_VOX_SB_NFF_6b_1.1       Wrap                VOX, Sandbox, Fungi    Acc1    Acc2, Acc3,Acc2, Acc3,Acc2, Acc3    1+1+1+1+1+1                 A, B, C, D, E, F      yes, no, yes, no, yes,no
         *
         * #UW_DVOX_DSB_DNFF_6b_1.2   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc2        Acc2                            1+1+1                       A, C, E               yes, yes, yes
         * #UW_DVOX_DSB_DNFF_6b_1.3   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc3        Acc3                            0.51+0.51+0.51              B,D,F                 no, no, no
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DVOX_DSB_DNFF_6b_1.4   Unwrap Batch        DVOX,DSB,DNFF          Acc2        Acc2                            1+1+1                       A, C, E               yes, yes, yes
         * #W_VOX_SB_NFF_6b_1.5       Wrap                VOX, Sandbox, Fungi    Acc2        Acc3                            1+1+1+1+1+1                 A+,C+,E+,G,H,I        yes, yes, yes,yes, yes, yes
         * #UW_DVOX_DSB_DNFF_6b_1.6   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc3        Acc2                            1+1+1+1+1+1+1+1+1           B,D,F,A+,C+,E+,G,H,I  yes, no, yes, no, yes,no, yes, yes, yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DVOX_DSB_DNFF_6b_1.7   MF: Unwrap Batch    DVOX,DSB,DNFF          Acc3        Acc2                            1+0.51+1+1+1+0.51+1+1+0.51  A+,B,G,C+,D,H,E+,F,I  yes, no, yes, no, yes,no, yes, yes, yes
         * #UW_DVOX_DSB_DNFF_6b_1.8   Unwrap Batch        DVOX,DSB,DNFF          Acc3        Acc2                            1+1+1+1+1+1+0.51+0.51+0.51  A+,B,C+,D,E+,F,G,H,I  yes, no, yes, no, yes,no, yes, yes, yes
         */

        var tokenHolderVox = "0xe995a353a97a33e2dbac9e70ba6778db86728f4e";

        var voxTokenAddresss = "0xad9fd7cb4fc7a0fbce08d64068f60cbde22ed34c";

        var voxTokenId = ["4159", "4158", "4157"];

        var vox = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            voxTokenAddresss
        );

        await approveHost(tokenHolderVox);

        await Promise.all(
            voxTokenId.map((id) =>
                vox.methods
                    .safeTransferFrom(tokenHolderVox, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderVox,
                        })
                    )
            )
        );

        await Promise.all(
            voxTokenId.map((id) =>
                vox.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                )
            )
        );

        var tokenHolderSandbox = "0x9cfA73B8d300Ec5Bf204e4de4A58e5ee6B7dC93C";

        var sandboxTokenAddresss = "0x50f5474724e0ee42d9a4e711ccfb275809fd6d4a";

        var sandboxTokenId = ["9435", "9436", "9437"];

        var sandbox = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            sandboxTokenAddresss
        );

        await approveHost(tokenHolderSandbox);

        await Promise.all(
            sandboxTokenId.map((id) =>
                sandbox.methods
                    .safeTransferFrom(tokenHolderSandbox, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderSandbox,
                        })
                    )
            )
        );

        await Promise.all(
            sandboxTokenId.map((id) =>
                sandbox.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                )
            )
        );

        var tokenHolderFunghi = "0x1d2c4cd9bee9dfe088430b95d274e765151c32db";

        var funghiTokenAddresss = "0x5f47079d0e45d95f5d5167a480b695883c4e47d9";

        var funghiTokenId = ["44", "89", "12"];

        var funghi = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            funghiTokenAddresss
        );

        await approveHost(tokenHolderFunghi);

        await Promise.all(
            funghiTokenId.map((id) =>
                funghi.methods
                    .safeTransferFrom(tokenHolderFunghi, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderFunghi,
                        })
                    )
            )
        );

        await Promise.all(
            funghiTokenId.map((id) =>
                funghi.methods.approve(wrapper.options.address, id).send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                )
            )
        );

        // #W_VOX_SB_NFF_6b_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            [
                voxTokenId[0],
                voxTokenId[1],
                sandboxTokenId[0],
                sandboxTokenId[1],
                funghiTokenId[0],
                funghiTokenId[1],
            ],
            [
                accounts[2],
                accounts[3],
                accounts[2],
                accounts[3],
                accounts[2],
                accounts[3],
            ],
            [
                voxTokenAddresss,
                voxTokenAddresss,
                sandboxTokenAddresss,
                sandboxTokenAddresss,
                funghiTokenAddresss,
                funghiTokenAddresss,
            ],
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true, false, true, false, true, false])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var itemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            vox,
            [voxTokenId[0], voxTokenId[1]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            sandbox,
            [sandboxTokenId[0], sandboxTokenId[1]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            funghi,
            [funghiTokenId[0], funghiTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "1000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[4],
            wrapper
        );

        // #W_VOX_SB_NFF_6b_1.1 END

        // #UW_DVOX_DSB_DNFF_6b_1.2 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[3], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[2],
                    [itemIds[0], itemIds[2], itemIds[4]],
                    [
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DVOX_DSB_DNFF_6b_1.2 END

        // #UW_DVOX_DSB_DNFF_6b_1.3 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[1], accounts[3], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[1],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[1],
                accounts[3],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [itemIds[0], itemIds[2], itemIds[4]],
                    [
                        "510000000000000000",
                        "510000000000000000",
                        "510000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DVOX_DSB_DNFF_6b_1.3 END

        // JumpToBlock START
        await blockchainConnection.fastForward(blockToSkip);
        // JumpToBlock END

        // #UW_DVOX_DSB_DNFF_6b_1.4 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var tx = await wrapper.methods
            .burnBatch(
                accounts[2],
                [itemIds[0], itemIds[2], itemIds[4]],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            vox,
            [voxTokenId[0]]
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            sandbox,
            [sandboxTokenId[0]]
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            funghi,
            [funghiTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            itemIds[4],
            wrapper
        );

        // #UW_DVOX_DSB_DNFF_6b_1.4 END

        await sandbox.methods
            .safeTransferFrom(accounts[1], accounts[2], sandboxTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await vox.methods
            .safeTransferFrom(accounts[1], accounts[2], voxTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await funghi.methods
            .safeTransferFrom(accounts[1], accounts[2], funghiTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await funghi.methods
            .approve(wrapper.options.address, funghiTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await funghi.methods
            .approve(wrapper.options.address, funghiTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await vox.methods.approve(wrapper.options.address, voxTokenId[0]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[2],
            })
        );

        await vox.methods.approve(wrapper.options.address, voxTokenId[2]).send(
            blockchainConnection.getSendingOptions({
                from: accounts[2],
            })
        );

        await sandbox.methods
            .approve(wrapper.options.address, sandboxTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await sandbox.methods
            .approve(wrapper.options.address, sandboxTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        // #W_VOX_SB_NFF_6b_1.5 START

        var createItem = await wrapperResource.generateCreateItem(
            [
                voxTokenId[0],
                sandboxTokenId[0],
                funghiTokenId[0],
                voxTokenId[2],
                sandboxTokenId[2],
                funghiTokenId[2],
            ],
            [
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
            ],
            [
                voxTokenAddresss,
                sandboxTokenAddresss,
                funghiTokenAddresss,
                voxTokenAddresss,
                sandboxTokenAddresss,
                funghiTokenAddresss,
            ],
            [
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
                "1000000000000000000",
            ]
        );

        var tx = await wrapper.methods
            .mintItems(createItem, [true, true, true, true, true, true])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "2",
            vox,
            [voxTokenId[0], voxTokenId[2]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "2",
            sandbox,
            [sandboxTokenId[0], sandboxTokenId[2]]
        );

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "2",
            funghi,
            [funghiTokenId[0], funghiTokenId[2]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "2000000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            itemIds[4],
            wrapper
        );

        // #W_VOX_SB_NFF_6b_1.5 END

        // #UW_DVOX_DSB_DNFF_6b_1.6 START

        datas[0] = web3.eth.abi.encodeParameters(//b
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[1], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(//d
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(//f
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[3] = web3.eth.abi.encodeParameters(//a
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[2], "0x", false, false]
        );
        datas[4] = web3.eth.abi.encodeParameters(//c+
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[5] = web3.eth.abi.encodeParameters(//e
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[6] = web3.eth.abi.encodeParameters(//g
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[2], accounts[2], "0x", false, false]
        );
        datas[7] = web3.eth.abi.encodeParameters(//h
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[8] = web3.eth.abi.encodeParameters(//i
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [
                        itemIds[0],
                        itemIds[2],
                        itemIds[4],
                        itemIds[0],
                        itemIds[2],
                        itemIds[4],
                        itemIds[0],
                        itemIds[2],
                        itemIds[4],
                    ],
                    [
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DVOX_DSB_DNFF_6b_1.6 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DVOX_DSB_DNFF_6b_1.7 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[1], accounts[2], "0x", false, false]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[2], accounts[2], "0x", false, false]
        );
        datas[3] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[4] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[5] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[6] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[7] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[8] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [
                        itemIds[0],
                        itemIds[0],
                        itemIds[0],
                        itemIds[2],
                        itemIds[2],
                        itemIds[2],
                        itemIds[4],
                        itemIds[4],
                        itemIds[4],
                    ],
                    [
                        "1000000000000000000",
                        "510000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "510000000000000000",
                        "1000000000000000000",
                        "1000000000000000000",
                        "510000000000000000",
                    ],
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Invalid amount"
        );

        // #UW_DVOX_DSB_DNFF_6b_1.7 END

        // #UW_DVOX_DSB_DNFF_6b_1.8 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[0], accounts[2], "0x", false, false]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[1], accounts[2], "0x", false, false]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[3] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[4] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[0],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[5] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[1],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[6] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                funghiTokenAddresss,
                funghiTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );
        datas[7] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [voxTokenAddresss, voxTokenId[2], accounts[2], "0x", false, false]
        );
        datas[8] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                sandboxTokenAddresss,
                sandboxTokenId[2],
                accounts[2],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);


        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [
                    itemIds[0],
                    itemIds[0],
                    itemIds[2],
                    itemIds[2],
                    itemIds[4],
                    itemIds[4],
                    itemIds[4],
                    itemIds[0],
                    itemIds[2],


                ],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                    "1000000000000000000",
                    "510000000000000000",
                    "510000000000000000",
                    "510000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "3",
            vox,
            voxTokenId
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "3",
            sandbox,
            sandboxTokenId
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "3",
            funghi,
            funghiTokenId
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-2510000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-2510000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "-2510000000000000000",
            itemIds[4],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2510000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2510000000000000000",
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2510000000000000000",
            itemIds[4],
            wrapper
        );

        // #UW_DVOX_DSB_DNFF_6b_1.8 END
    });

    it("#7", async () => {
        /**
         * Label            ||   Operation        || Token         || From  || Receiver address ||amount    || Token Reference             || Lock
         * #W_BA_7_1.1           Wrap                Bored Ape        Acc1     Acc1               1            A                               yes
         *
         * #UW_DBA_7_1.2         Unwrap              DBA              Acc1     Acc1               1            A                               yes
         * #W_BA_7_1.3           Wrap                Bored Ape        Acc1     Acc1,Acc2          1,1          A+,B                            yes,yes
         * #W_BA_GODS_7_1.4      Wrap                Bored Ape,GODS   Acc2     Acc2               1,1          C,D                             yes,yes
         * #UW_DBA_7_1.5         MF: Unwrap          DBA              Acc2     Acc1               1            A                               yes
         * #UW_DGODS_7_1.6       MF: Unwrap          DGODS            Acc1     Acc1               1            D (passing A itemId)            yes
         * #UW_DBA_7_1.7         MF: Unwrap          DBA              Acc1     Acc1               1            C (passing empty itemId)        yes
         * #UW_DGODS_7_1.8       MF: Unwrap          DGODS            Acc1     Acc1               1            D (passing empty itemId)        yes
         * JumpToBlock ---------------------------------------------------------------------------------------------------------------------------
         * #UW_DBA_7_1.9         MF: Unwrap          DBA              Acc1     Acc1               1            A+ (passing empty tokenAddress) yes
         * #UW_DBA_7_2.1         MF: Unwrap          DBA              Acc1     Acc1               1            A+ (passing empty tokenId)      yes
         * #UW_DBA_7_2.2         MF: Unwrap          DBA              Acc2     Acc1               1            A+ (passing empty tokenAddress) yes
         * #UW_DBA_7_2.3         MF: Unwrap          DBA              Acc2     Acc1               1            A+ (passing empty tokenId)      yes
         * #UW_DBA_7_2.4         Unwrap              DBA              Acc1     Acc1               1            A+                              yes
         * #UWB_DBA_DGODS_7_2.5  Unwrap batch        DBA,DGODS        Acc2     Acc1               1,1,0.51     B,C,D                           yes,yes,yes
         */

        var tokenHolderBoredApe = "0x1b523DC90A79cF5ee5d095825e586e33780f7188";

        var boredApeTokenAddresss =
            "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";

        var boredApeTokenId = ["9003", "7701", "4959"];

        var boredApe = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            boredApeTokenAddresss
        );

        await approveHost(tokenHolderBoredApe);

        await Promise.all(
            boredApeTokenId.slice(0, 2).map(async (id, index) => {
                await boredApe.methods
                    .safeTransferFrom(tokenHolderBoredApe, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderBoredApe,
                        })
                    );
            })
        );

        await boredApe.methods
            .safeTransferFrom(
                tokenHolderBoredApe,
                accounts[2],
                boredApeTokenId[2]
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderBoredApe,
                })
            );

        await Promise.all(
            boredApeTokenId.slice(0, 2).map(async (id, index) => {
                await boredApe.methods
                    .approve(wrapper.options.address, id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[1],
                        })
                    );
            })
        );

        await boredApe.methods
            .approve(wrapper.options.address, boredApeTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        // #W_BA_7_1.1 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1000000000000000000"], [accounts[1]], true]
        );

        tx = await boredApe.methods
            .safeTransferFrom(
                accounts[1],
                wrapper.options.address,
                boredApeTokenId[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var boredApeItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "1",
            boredApe,
            [boredApeTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_7_1.1 END

        // #UW_DBA_7_1.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[1], boredApeItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            boredApe,
            [boredApeTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UW_DBA_7_1.2 END

        var tokenHolder = "0x7891f796a5d43466fC29F102069092aEF497a290";

        var godsTokenAddresss = "0x0e3a2a1f2146d86a604adc220b4967a898d7fe07";

        var godsTokenId = ["83259072"];

        var gods = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            godsTokenAddresss
        );

        await approveHost(tokenHolder);

        await Promise.all(
            godsTokenId.map(async (id, index) => {
                await gods.methods
                    .safeTransferFrom(tokenHolder, accounts[2], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolder,
                        })
                    );
            })
        );

        await gods.methods
            .approve(wrapper.options.address, godsTokenId[0])
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await Promise.all(
            boredApeTokenId.slice(0, 2).map(async (id, index) => {
                await boredApe.methods
                    .approve(wrapper.options.address, id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[1],
                        })
                    );
            })
        );

        await boredApe.methods
            .approve(wrapper.options.address, boredApeTokenId[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        // #W_BA_7_1.3 START

        var createItem = await wrapperResource.generateCreateItem(
            [boredApeTokenId[0], boredApeTokenId[1]],
            [accounts[1], accounts[2]],
            [boredApeTokenAddresss, boredApeTokenAddresss],
            ["1000000000000000000", "1000000000000000000"]
        );

        var lock = [true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        await wrapperResource.checkBalance(
            tx,
            accounts[1],
            wrapper.options.address,
            "2",
            boredApe,
            [boredApeTokenId[0], boredApeTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "2000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_7_1.3 END

        // #W_BA_GODS_7_1.4 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [["1000000000000000000"], [accounts[2]], true]
        );

        txbored = await boredApe.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                boredApeTokenId[2],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var itemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        tx = await gods.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                godsTokenId[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var itemIdsGods = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        itemIds[1] = itemIdsGods[0];

        await wrapperResource.checkBalance(
            tx,
            accounts[2],
            wrapper.options.address,
            "1",
            gods,
            [godsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1000000000000000000",
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "1000000000000000000",
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkBalance(
            txbored,
            accounts[2],
            wrapper.options.address,
            "1",
            boredApe,
            [boredApeTokenId[2]]
        );

        await wrapperResource.checkBalanceItem(
            txbored,
            accounts[2],
            "1000000000000000000",
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            txbored,
            "1000000000000000000",
            itemIds[0],
            wrapper
        );

        // #W_BA_GODS_7_1.4 END

        // #UW_DBA_7_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[2],
                    boredApeItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DBA_7_1.5 END

        // #UW_DGODS_7_1.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[1], "0x", false, false]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    boredApeItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "wrong erc721"
        );

        // #UW_DGODS_7_1.6 END

        // #UW_DBA_7_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[2],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], "0", "1000000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Wrong ERC721"
        );

        // #UW_DBA_7_1.7 END

        // #UW_DGODS_7_1.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[1], "0x", false, false]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], "0", "1000000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Wrong ERC721"
        );

        // #UW_DGODS_7_1.8 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DBA_7_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                utilities.voidEthereumAddress,
                boredApeTokenId[0],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    boredApeItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Wrong ERC721"
        );

        // #UW_DBA_7_1.9 END

        // #UW_DBA_7_2.1 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                0,
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], boredApeItemIds[0], "1000000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "Invalid Token ID"
        );

        // #UW_DBA_7_2.1 END

        // #UW_DBA_7_2.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                utilities.voidEthereumAddress,
                boredApeTokenId[2],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[2],
                    boredApeItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Wrong ERC721"
        );

        // #UW_DBA_7_2.2 END

        // #UW_DBA_7_2.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                0,
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[2], boredApeItemIds[0], "1000000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Invalid Token ID"
        );

        // #UW_DBA_7_2.3 END

        // #UW_DBA_7_2.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[0],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[1], boredApeItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            boredApe,
            [boredApeTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UW_DBA_7_2.4 END

        // #UWB_DBA_DGODS_7_2.5 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[1],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                boredApeTokenAddresss,
                boredApeTokenId[2],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [godsTokenAddresss, godsTokenId[0], accounts[1], "0x", false, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var tx = await wrapper.methods
            .burnBatch(
                accounts[2],
                [boredApeItemIds[0], boredApeItemIds[0], itemIds[1]],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                    "510000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[1],
            "2",
            boredApe,
            [boredApeTokenId[1], boredApeTokenId[2]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-2000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            gods,
            [godsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-510000000000000000",
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-510000000000000000",
            itemIds[1],
            wrapper
        );

        // #UWB_DBA_DGODS_7_2.5 END
    });



    it("#8", async () => {
        /**
         * Label            ||   Operation        || Token         || From  || Receiver address ||amount    || Token Reference                  || Lock
         * #W_NFT_8_1.1          Wrap                NFT Worlds       Acc1     Acc2               1,1          A,B                                 yes,yes
         *
         * #UL_DNFT_8_1.2        MF: Unlock          DNFT             Acc2     //                 //           A,B                                 yes,yes
         * #UL_DNFT_8_1.3        Unlock              DNFT             Acc1     //                 //           A*                                  yes        *address (0) and token id empty
         * #UL_DNFT_8_1.4        Unlock              DNFT             Acc1     //                 //           A                                   yes
         * #UW_DNFT_8_1.5        Unwrap              DNFT             Acc2     Acc2               1            A                                   no
         * #W_BA_8_1.6           Wrap                Bored Ape        Acc1     Acc2,Acc2          1,1          C,F                                 yes,yes
         * #W_BA_8_1.7           Wrap                Bored Ape        Acc2     Acc2,Acc1          1,1          D,E                                 yes,no
         * #UL_DBA_8_1.8         Unlock              DBA              Acc2     //                 //           E                                   no
         * #UW_DBA_8_1.9         Unwrap              DBA              Acc1     Acc1               1            E                                   no
         * #UL_DBA_8_2.1         MF: Unlock          DBA              Acc2     //                 //           C                                   yes
         * #UL_DBA_8_2.2         Unlock              DBA              Acc1     //                 //           C**                                 yes,yes    ** 1)pass tokenaddress and token id don't exist (ENS), 2)token address bored ape and id (ENS) not wrapped, 3)token address bored ape and id of B
         * #UL_DBA_8_2.3         MF: Unlock          DBA              Acc1     //                 //           D                                   yes
         * #UW_DBA_8_2.4         MF: Unwrap          DBA              Acc1     Acc1               1            D                                   yes
         * #UL_DBA_8_2.5         MF: Unlock          DBA              Acc2     //                 //           D,F                                 yes,yes
         * #UW_DBA_8_2.6         Unwrap              DBA              Acc2     Acc1               1,1          C,D                                 no,yes
         * #UW_DBA_8_2.7         MF:Unwrap           DBA              Acc2     Acc1               1            F                                   yes
         * JumpToBlock -----------------------------------------------------------------------------------------------------------------------------------
         * #UW_DBA_8_2.8         Unwrap              DBA              Acc2     Acc1               1            F                                   yes
         */

        var nftWorldsTokenHolder = "0xd387a6e4e84a6c86bd90c158c6028a58cc8ac459";

        var nftWorldsTokenAddresss = "0xBD4455dA5929D5639EE098ABFaa3241e9ae111Af";

        var nftWorldsTokenId = ["8558", "9464"];

        var nftWorlds = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            nftWorldsTokenAddresss
        );

        await approveHost(nftWorldsTokenHolder);

        await Promise.all(
            nftWorldsTokenId.map(async (id, index) => {
                await nftWorlds.methods
                    .safeTransferFrom(nftWorldsTokenHolder, accounts[1], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: nftWorldsTokenHolder,
                        })
                    );
                await nftWorlds.methods
                    .approve(wrapper.options.address, id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[1]
                        })
                    );
            })
        );

        // #W_NFT_8_1.1 START

        var createItem = await wrapperResource.generateCreateItem(
            [nftWorldsTokenId[0], nftWorldsTokenId[1]],
            [accounts[2], accounts[2]],
            [nftWorldsTokenAddresss, nftWorldsTokenAddresss],
            ["1000000000000000000", "1000000000000000000"]
        );

        var lock = [true, true];

        var txAe = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1]
                })
            );

        var logs = (await web3.eth.getTransactionReceipt(txAe.transactionHash))
            .logs;

        var nftWorldsItemIds = logs
            .filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            txAe,
            accounts[1],
            wrapper.options.address,
            "2",
            nftWorlds,
            [nftWorldsTokenId[0], nftWorldsTokenId[1]]
        );

        await wrapperResource.checkBalanceItem(
            txAe,
            accounts[2],
            "2000000000000000000",
            nftWorldsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            txAe,
            "2000000000000000000",
            nftWorldsItemIds[0],
            wrapper
        );

        // #W_NFT_8_1.1 END

        // #UL_DNFT_8_1.2 START

        await catchCall(wrapper.methods.unlockReserves((await getIdAndAddressFromEvents(txAe))["address"], (await getIdAndAddressFromEvents(txAe))["id"]).send(blockchainConnection.getSendingOptions({
            from: accounts[2]
        })), "Cannot unlock");

        // #UL_DNFT_8_1.2 END

        // #UL_DNFT_8_1.3 START

        await wrapperResource.checkReserveData(
            txAe,
            accounts[1],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        await wrapper.methods.unlockReserves([(await getIdAndAddressFromEvents(txAe))["address"][0], utilities.voidEthereumAddress], [(await getIdAndAddressFromEvents(txAe))["id"][0], 0]).send(blockchainConnection.getSendingOptions({
            from: accounts[1]
        }));

        assert.equal((await wrapper.methods.reserveData((await getIdAndAddressFromEvents(txAe))["address"][0], (await getIdAndAddressFromEvents(txAe))["id"][0]).call()).timeout, "0");

        assert.equal((await wrapper.methods.reserveData(utilities.voidEthereumAddress, 0).call()).timeout, "0");

        // #UL_DNFT_8_1.3 END

        // #UL_DNFT_8_1.4 START

        await wrapper.methods.unlockReserves([(await getIdAndAddressFromEvents(txAe))["address"][0]], [(await getIdAndAddressFromEvents(txAe))["id"][0]]).send(blockchainConnection.getSendingOptions({
            from: accounts[1]
        }));

        // #UL_DNFT_8_1.4 END

        assert.equal((await wrapper.methods.reserveData((await getIdAndAddressFromEvents(txAe))["address"][0], (await getIdAndAddressFromEvents(txAe))["id"][0]).call()).timeout, "0");

        assert.equal((await wrapper.methods.reserveData(utilities.voidEthereumAddress, 0).call()).timeout, "0");


        // #UW_DNFT_8_1.5 START
        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [(await getIdAndAddressFromEvents(txAe))["address"][0], (await getIdAndAddressFromEvents(txAe))["id"][0], accounts[2], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[2], nftWorldsItemIds[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            nftWorlds,
            [nftWorldsTokenId[0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            nftWorldsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            nftWorldsItemIds[0],
            wrapper
        );

        // #UW_DNFT_8_1.5 END

        var tokenHolderBoredApe = "0x1b523dc90a79cf5ee5d095825e586e33780f7188";

        var boredApeTokenAddresss =
            "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";

        var boredApeTokenId = ["7789", "7790", "7791", "5323"];
        var boredApeReceivers = [accounts[1], accounts[2], accounts[1], accounts[2]];

        var boredApe = new web3.eth.Contract(
            knowledgeBase.IERC721ABI,
            boredApeTokenAddresss
        );

        await approveHost(tokenHolderBoredApe);

        await Promise.all(
            boredApeTokenId.map(async (id, index) => {
                await boredApe.methods
                    .safeTransferFrom(tokenHolderBoredApe, boredApeReceivers[index], id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderBoredApe,
                        })
                    );
            })
        );

        await Promise.all(
            boredApeTokenId.map(async (id, index) => {
                await boredApe.methods
                    .approve(wrapper.options.address, id)
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: boredApeReceivers[index],
                        })
                    );
            })
        );

        // #W_BA_8_1.6 START

        var createItem = await wrapperResource.generateCreateItem(
            [boredApeTokenId[0], boredApeTokenId[2]],
            [accounts[2], accounts[2]],
            [
                boredApeTokenAddresss,
                boredApeTokenAddresss,
            ],
            [
                "1000000000000000000",
                "1000000000000000000",
            ]
        );

        var lock = [true, true];

        var txbd = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1]
                })
            );

        var logs = (await web3.eth.getTransactionReceipt(txbd.transactionHash))
            .logs;

        var boredApeItemIds = logs
            .filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkReserveData(
            txbd,
            accounts[1],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        assert.equal(
            await wrapper.methods.source(boredApeItemIds[0]).call(),
            web3.utils.toChecksumAddress(boredApeTokenAddresss)
        );

        await wrapperResource.checkBalance(
            txbd,
            accounts[1],
            wrapper.options.address,
            "2",
            boredApe,
            [boredApeTokenId[0], boredApeTokenId[2]]
        );

        await wrapperResource.checkBalanceItem(
            txbd,
            accounts[2],
            "2000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            txbd,
            "2000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #W_BA_8_1.6 END

        // #W_BA_8_1.7 START

        var createItemC = await wrapperResource.generateCreateItem(
            [boredApeTokenId[1], boredApeTokenId[3]],
            [accounts[2], accounts[1]],
            [
                boredApeTokenAddresss,
                boredApeTokenAddresss
            ],
            [
                "1000000000000000000",
                "1000000000000000000"
            ]
        );

        var lockC = [true, false];

        var txc = await wrapper.methods
            .mintItems(createItemC, lockC)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2]
                })
            );

        var logs = (await web3.eth.getTransactionReceipt(txc.transactionHash))
            .logs;

        var boredApeItemIds2 = logs
            .filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance(
            txc,
            accounts[2],
            wrapper.options.address,
            "2",
            boredApe,
            [boredApeTokenId[1], boredApeTokenId[3]]
        );

        await wrapperResource.checkBalanceItem(
            txc,
            accounts[2],
            "1000000000000000000",
            boredApeItemIds2[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            txc,
            accounts[1],
            "1000000000000000000",
            boredApeItemIds2[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            txc,
            "2000000000000000000",
            boredApeItemIds2[0],
            wrapper
        );

        // #W_BA_8_1.7 END

        // #UL_DBA_8_1.8 START

        await wrapperResource.checkReserveData(
            txc,
            accounts[2],
            createItemC,
            lockC,
            blockToSkip,
            wrapper
        );

        await wrapper.methods.unlockReserves([(await getIdAndAddressFromEvents(txc))["address"][1]], [(await getIdAndAddressFromEvents(txc))["id"][1]]).send(blockchainConnection.getSendingOptions({
            from: accounts[2]
        }));

        assert.equal((await wrapper.methods.reserveData((await getIdAndAddressFromEvents(txc))["address"][1], (await getIdAndAddressFromEvents(txc))["id"][1]).call()).timeout, "0");

        // #UL_DBA_8_1.8 END

        // #UW_DBA_8_1.9 START
        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [(await getIdAndAddressFromEvents(txc))["address"][1], (await getIdAndAddressFromEvents(txc))["id"][1], accounts[1], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[1], boredApeItemIds2[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            boredApe,
            [(await getIdAndAddressFromEvents(txc))["id"][1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            "-1000000000000000000",
            boredApeItemIds2[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            boredApeItemIds2[0],
            wrapper
        );

        // #UW_DBA_8_1.9 END

        // #UL_DBA_8_2.1 START

        await catchCall(wrapper.methods.unlockReserves([(await getIdAndAddressFromEvents(txbd))["address"][0]], [(await getIdAndAddressFromEvents(txbd))["id"][0]]).send(blockchainConnection.getSendingOptions({
            from: accounts[2]
        })), "Cannot unlock");

        // #UL_DBA_8_2.1 END

        // #UL_DBA_8_2.2 START

        await wrapperResource.checkReserveData(
            txbd,
            accounts[1],
            createItem,
            lock,
            blockToSkip,
            wrapper
        );

        var ENSTokenAddresss = "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85";
        var ENSTokenId = [
            "76209759912004573400534475157126407931116638124477574818832130517944945631566",
        ];
        await wrapper.methods.unlockReserves([(await getIdAndAddressFromEvents(txbd))["address"][0], ENSTokenAddresss, (await getIdAndAddressFromEvents(txbd))["address"][0], (await getIdAndAddressFromEvents(txbd))["address"][0]], [(await getIdAndAddressFromEvents(txbd))["id"][0], ENSTokenId[0], ENSTokenId[0], (await getIdAndAddressFromEvents(txAe))["id"][1]]).send(blockchainConnection.getSendingOptions({
            from: accounts[1]
        }));

        // #UL_DBA_8_2.2 END

        assert.equal((await wrapper.methods.reserveData((await getIdAndAddressFromEvents(txbd))["address"][0], (await getIdAndAddressFromEvents(txbd))["id"][0]).call()).timeout, "0");
        assert.equal((await wrapper.methods.reserveData(ENSTokenAddresss, ENSTokenId[0]).call()).timeout, "0");
        assert.equal((await wrapper.methods.reserveData((await getIdAndAddressFromEvents(txbd))["address"][0], ENSTokenId[0]).call()).timeout, "0");

        await wrapperResource.checkReserveData(
            txc,
            accounts[2],
            createItemC,
            lockC,
            blockToSkip,
            wrapper
        );
        // #UL_DBA_8_2.3 START

        await catchCall(wrapper.methods.unlockReserves([(await getIdAndAddressFromEvents(txc))["address"][0]], [(await getIdAndAddressFromEvents(txc))["id"][0]]).send(blockchainConnection.getSendingOptions({
            from: accounts[1]
        })), "Cannot unlock");

        // #UL_DBA_8_2.3 END

        // #UW_DBA_8_2.4 START
        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                (await getIdAndAddressFromEvents(txc))["address"][0],
                (await getIdAndAddressFromEvents(txc))["id"][0],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        await catchCall(
            wrapper.methods
            .burn(
                accounts[1],
                boredApeItemIds[0],
                "1000000000000000000",
                data
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            "Cannot unlock"
        );

        // #UW_DBA_8_2.4 END

        // #UW_DBA_8_2.5 START

        await catchCall(wrapper.methods.unlockReserves([boredApeTokenAddresss, boredApeTokenAddresss], [boredApeTokenId[2], boredApeTokenId[3]]).send(blockchainConnection.getSendingOptions({
            from: accounts[2]
        })), "cannot unlock");
        // #UW_DBA_8_2.5 END

        // #UW_DBA_8_2.6 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                (await getIdAndAddressFromEvents(txbd))["address"][0],
                (await getIdAndAddressFromEvents(txbd))["id"][0],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [
                (await getIdAndAddressFromEvents(txc))["address"][0],
                (await getIdAndAddressFromEvents(txc))["id"][0],
                accounts[1],
                "0x",
                false,
                false,
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var tx = await wrapper.methods
            .burnBatch(
                accounts[2],
                [boredApeItemIds[0], boredApeItemIds2[0]],
                [
                    "1000000000000000000",
                    "1000000000000000000",
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[1],
            "2",
            boredApe,
            [(await getIdAndAddressFromEvents(txbd))["id"][0], (await getIdAndAddressFromEvents(txc))["id"][0]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-2000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-2000000000000000000",
            boredApeItemIds[0],
            wrapper
        );

        // #UW_DBA_8_2.6 END

        // #UW_DBA_8_2.7 START
        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [(await getIdAndAddressFromEvents(txbd))["address"][1], (await getIdAndAddressFromEvents(txbd))["id"][1], accounts[1], "0x", false, false]
        );

        await catchCall(wrapper.methods
            .burn(accounts[2], boredApeItemIds2[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            ), "Cannot unlock");

        // #UW_DBA_8_2.7 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DBA_8_2.8 START

        data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes", "bool", "bool"],
            [(await getIdAndAddressFromEvents(txbd))["address"][1], (await getIdAndAddressFromEvents(txbd))["id"][1], accounts[1], "0x", false, false]
        );

        var tx = await wrapper.methods
            .burn(accounts[2], boredApeItemIds2[0], "1000000000000000000", data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            boredApe,
            [(await getIdAndAddressFromEvents(txbd))["id"][1]]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "-1000000000000000000",
            boredApeItemIds2[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "-1000000000000000000",
            boredApeItemIds2[0],
            wrapper
        );

        // #UW_DBA_8_2.8 END
    });
});
