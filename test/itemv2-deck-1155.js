var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");
const blockchainConnection = require("../util/blockchainConnection");
var keccak = require("keccak");
var erc20Contract;

describe("itemv2 ERC1155DeckWrapper", () => {
    var blockToSkip = 50;
    var wrapper;
    var MainInterface;
    var mainInterface;
    var ItemInteroperableInterface;
    var itemInteroperableInterface;
    var itemInteroperableInterfaceAddress;
    var itemsList = [];
    var approvedHost = [];

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
        var events = await getEvents("ReserveData", tx);
        var id = events.map((ev, index) => {
            return ev.returnValues.tokenId;
        });
        var address = events.map((ev, index) => {
            return ev.returnValues.tokenAddress;
        });
        var amount = events.map((ev, index) => {
            return ev.returnValues.amount;
        });
        var from = events.map((ev, index) => {
            return ev.returnValues.from;
        });
        return {id, address, amount, from};
    }

    async function getKeyFromEvent(tx){
        var events = await getEvents("ReserveData", tx);
        var key = events.map((ev, index) => {
            return ev.returnValues.reserveDataKey;
        });
        return {key};
    }

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
                utilities.voidBytes32,
            ]
        );

        mainInterface = await itemsv2.getMainInterface();

        deployParam = abi.encode(
            ["address", "bytes"],
            [accounts[1], deployParam]
        );

        try {
            var ERC1155DeckWrapperUtilities = await compile(
                "projection/ERC1155Deck/ERC1155DeckWrapper",
                "ERC1155DeckWrapperUtilities"
            );
        } catch(e) {
            console.error(e)
        }

        var eRC1155DeckWrapperUtilities = await new web3.eth.Contract(
            ERC1155DeckWrapperUtilities.abi
        )
            .deploy({ data: ERC1155DeckWrapperUtilities.bin })
            .send(blockchainConnection.getSendingOptions());
        var contractPath =
            ERC1155DeckWrapperUtilities.ast.absolutePath +
            ":" +
            ERC1155DeckWrapperUtilities.contractName;
        var contractKey =
            "__$" +
            keccak("keccak256")
                .update(contractPath)
                .digest()
                .toString("hex")
                .slice(0, 34) +
            "$__";

        var ERC1155Wrapper = await compile(
            "projection/ERC1155Deck/ERC1155DeckWrapper"
        );
        ERC1155Wrapper.bin = ERC1155Wrapper.bin
            .split(contractKey)
            .join(eRC1155DeckWrapperUtilities.options.address.substring(2));
        var wrapperData = await new web3.eth.Contract(ERC1155Wrapper.abi)
            .deploy({ data: ERC1155Wrapper.bin, arguments: ["0x"] })
            .encodeABI();

        var blockNumber = abi.encode(["uint256"], [blockToSkip]);

        var data = await itemsv2.createCollection(
            headerCollection.host,
            items,
            wrapperData,
            blockNumber,
            headerCollection
        );

        wrapper = new web3.eth.Contract(
            ERC1155Wrapper.abi,
            data.projection.options.address
        );

        console.log("Wrapper Uri", await wrapper.methods.uri().call());
        assert.equal(
            await wrapper.methods.uri().call(),
            await mainInterface.methods
                .collectionUri(await wrapper.methods.collectionId().call())
                .call()
        );

        var ZeroDecimals = await compile("../resources/ERC1155ZeroDecimals");
        wrapperData = await new web3.eth.Contract(ZeroDecimals.abi)
            .deploy({ data: ZeroDecimals.bin, arguments: ["0x"] })
            .encodeABI();

        data = await itemsv2.createCollection(
            headerCollection.host,
            items,
            wrapperData,
            "0x",
            headerCollection
        );

        zeroDecimals = new web3.eth.Contract(
            ZeroDecimals.abi,
            data.projection.options.address
        );
    });

    it("#1", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address     || amount               || Token Reference       || Lock
         * #W_ZRN_1_1.1              Wrap                Zerion                Acc1     Acc1                    3                       A                        yes
         * #W_PRL_1_1.2              Wrap                Parallel              Acc2     Acc3                    1                       B                        no
         * #W_PRL_1_1.3              Wrap                Parallel              Acc2     Acc2                    1                       C                        yes
         * #W_OS_1_1.4               Wrap                OS                    Acc3     Acc4, Acc4              x, y                    D, E                     yes, no
         *
         * #UW_DZRN_1_1.5            MF: Unwrap          DZRN                   Acc1    Acc3                    2.51                    A                        yes
         * #TRA_DZRN_1_1.6           Transfer            DZRN                   Acc1    Acc3                    1                       //                       //
         * #UW_DZRN_1_1.7            MF: Unwrap          DZRN                   Acc3    Acc1                    1                       A                        yes
         * #UW_DZRN_1_1.8            Unwrap              DZRN                   Acc1    Acc4                    2                       A                        yes
         * #UW_DZRN_1_1.9            MF: Unwrap          DZRN                   Acc3    Acc1                    1                       A (passing C key)        yes
         * #UW_DZRN_1_2.1            Unwrap              DZRN                   Acc3    Acc1                    1                       A                        yes
         * #UW_DZRN_1_2.2            MF: Unwrap          DZRN                   Acc3    Acc3                    1                       A                        yes
         * #UW_DZRN_1_2.3            Unwrap              DPRL                   Acc2    Acc3                    1                       B                        no
         * #UW_DZRN_1_2.4            MF: Unwrap          DOS                    Acc4    Acc3                    z                       D                        yes
         * #UW_DZRN_1_2.5            Unwrap              DOS                    Acc4    Acc4                    y/2                     E                        no
         * #UW_DZRN_1_2.6            MF: Unwrap          DOS                    Acc4    Acc4                    y/2                     D                        yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DZRN_1_2.7            MF: Unwrap          DPRL                   Acc3    Acc2                    0.51                    C (passing empty key)    yes
         * #UW_DZRN_1_2.8            MF: Unwrap          DPRL                   Acc3    Acc2                    0.51                    C (passing D key)        yes
         * #UW_DZRN_1_2.9            Unwrap              DPRL                   Acc3    Acc2                    0.51                    C                        yes
         * #UWB_DZRN_1_3.1           Unwrap Batch        DOS                    Acc4    Acc3, Acc3              x, y/2                  D,E                      yes,no
         * #BRN_DGODS_1_3.2          Burn(Interop.)      DPRL                   Acc3     //                     0.49                    //                       //
         */
        var tokenHolderZerion = "0xecde04e088828c93a1003b9388727a25c064e5e3";

        var zerionTokenAddresss = "0x74EE68a33f6c9f113e22B3B77418B75f85d07D22";

        var zerionTokenId = ["10"];

        var zerion = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zerionTokenAddresss
        );

        await approveHost(tokenHolderZerion);

        await Promise.all(
            zerionTokenId.map(async (id, index) => {
                await zerion.methods
                    .safeTransferFrom(
                        tokenHolderZerion,
                        accounts[1],
                        id,
                        3,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderZerion,
                        })
                    );
            })
        );

        await zerion.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #W_ZRN_1_1.1 START

        var amountToWrap = ["3"];

        var createItem = await wrapperResource.generateCreateItem(
            zerionTokenId,
            [accounts[1]],
            [zerionTokenAddresss],
            amountToWrap
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var zerionItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var zerionKey = (await getKeyFromEvent(tx)).key;

        assert.equal(
            (await wrapper.methods.source(zerionItemIds[0]).call())
                .tokenAddress,
            web3.utils.toChecksumAddress(zerionTokenAddresss)
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            zerion,
            zerionTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            zerionItemIds[0],
            wrapper
        );

        // #W_ZRN_1_1.1 END

        var tokenHolderParallel = "0xd0829f8dda953e85da70b0a62a2f4e9a774ebf16";

        var parallelTokenAddresss =
            "0x76be3b62873462d2142405439777e971754e8e77";

        var parallelTokenId = ["10144", "10150"];

        var parallel = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            parallelTokenAddresss
        );

        await approveHost(tokenHolderParallel);

        await Promise.all(
            parallelTokenId.map(async (id, index) => {
                await parallel.methods
                    .safeTransferFrom(
                        tokenHolderParallel,
                        accounts[2],
                        id,
                        1,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderParallel,
                        })
                    );
            })
        );

        await parallel.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        // #W_PRL_1_1.2 START

        var amountToWrap = ["1"];

        var createItem = await wrapperResource.generateCreateItem(
            [parallelTokenId[0]],
            [accounts[3]],
            [parallelTokenAddresss],
            amountToWrap
        );

        var lock = [false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var parallelItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance1155(
            tx,
            accounts[2],
            wrapper.options.address,
            amountToWrap[0],
            parallel,
            parallelTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amountToWrap[0], 0),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            parallelItemIds[0],
            wrapper
        );

        // #W_PRL_1_1.2 END

        // #W_PRL_1_1.3 START

        var amountToWrap = ["1"];

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap, [accounts[2]], true]
        );

        tx = await parallel.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                parallelTokenId[1],
                amountToWrap[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );
        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var parallelKey = (await getKeyFromEvent(tx)).key

        await wrapperResource.checkBalance1155(
            tx,
            accounts[2],
            wrapper.options.address,
            amountToWrap[0],
            parallel,
            parallelTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            utilities.normalizeValue(amountToWrap[0], 0),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            parallelItemIds[0],
            wrapper
        );

        // #W_PRL_1_1.3 END

        var tokenHolderOs = "0x43126fb5e1fe86bb44b084d09f651358b97ebf0c";

        var osTokenAddresss = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var osTokenId = ["553791398095120659341456634783597180523460212593"];

        var os = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            osTokenAddresss
        );

        await approveHost(tokenHolderOs);

        await Promise.all(
            osTokenId.map(async (id, index) => {
                await os.methods
                    .safeTransferFrom(
                        tokenHolderOs,
                        accounts[3],
                        id,
                        await os.methods.balanceOf(tokenHolderOs, id).call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderOs,
                        })
                    );
            })
        );

        await os.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var balance = await os.methods
            .balanceOf(accounts[3], osTokenId[0])
            .call();

        // #W_OS_1_1.4 START

        var amountToWrap = [balance.div(6), balance.div(9)];
        var createItem = await wrapperResource.generateCreateItem(
            [osTokenId[0], osTokenId[0]],
            [accounts[4], accounts[4]],
            [osTokenAddresss, osTokenAddresss],
            amountToWrap
        );

        var lock = [true, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var osItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var osKey = (await getKeyFromEvent(tx)).key

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0].add(amountToWrap[1]),
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            amountToWrap[0].add(amountToWrap[1]),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[0].add(amountToWrap[1]),
            osItemIds[0],
            wrapper
        );

        // #W_OS_1_1.4 END

        // #UW_DZRN_1_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[3],
                zerionKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    zerionItemIds[0],
                    "2510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );

        // #UW_DZRN_1_1.5 END

        // #TRA_DZRN_1_1.6 START

        await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[3],
                zerionItemIds[0],
                "1000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        // #TRA_DZRN_1_1.6 END

        // #UW_DZRN_1_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[1],
                zerionKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    zerionItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DZRN_1_1.7 END

        // #UW_DZRN_1_1.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[4],
                zerionKey,
                "0x",
            ]
        );

        var amountToBurn = "2000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], zerionItemIds[0], amountToBurn, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[4],
            amountToBurn[0],
            zerion,
            zerionTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToBurn.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToBurn.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, zerionTokenAddresss, zerionTokenId[0], zerionKey, wrapper, [amountToBurn[0]]);

        // #UW_DZRN_1_1.8 END

        // #UW_DZRN_1_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[1],
                parallelKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    zerionItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "invalid reserve"
        );

        // #UW_DZRN_1_1.9 END

        // #UW_DZRN_1_2.1 START

        var amountToBurn = "1000000000000000000";

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], zerionItemIds[0], amountToBurn, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToBurn[0],
            zerion,
            zerionTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToBurn.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToBurn.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        // #UW_DZRN_1_2.1 END

        // #UW_DZRN_1_2.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionTokenAddresss,
                zerionTokenId[0],
                accounts[3],
                zerionKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    zerionItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "insuff"
        );

        // #UW_DZRN_1_2.2 END

        // #UW_DZRN_1_2.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[0],
                accounts[3],
                zerionKey,
                "0x",
            ]
        );

        var amountToBurn = "1000000000000000000";

        await wrapper.methods
            .burn(accounts[2], parallelItemIds[0], amountToBurn, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToBurn[0],
            parallel,
            parallelTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToBurn.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToBurn.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, parallelTokenAddresss, parallelTokenId[0], zerionKey, wrapper, [amountToBurn[0]]);

        // #UW_DZRN_1_2.3 END

        // #UW_DZRN_1_2.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osTokenAddresss, osTokenId[0], accounts[3], osKey, "0x"]
        );

        var amountToUnwrap = amountToWrap[0].add(amountToWrap[1]).div(2);

        await catchCall(
            wrapper.methods
                .burn(accounts[4], osItemIds[0], amountToUnwrap, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[4],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DZRN_1_2.4 END

        // #UW_DZRN_1_2.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                osTokenAddresss,
                osTokenId[0],
                accounts[4],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var amountToUnwrap = amountToWrap[1].div(2);

        await wrapper.methods
            .burn(accounts[4], osItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[4],
            amountToUnwrap,
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            amountToUnwrap.mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            osItemIds[0],
            wrapper
        );

        // #UW_DZRN_1_2.5 END

        // #UW_DZRN_1_2.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osTokenAddresss, osTokenId[0], accounts[4], osKey, "0x"]
        );

        var amountToUnwrap = amountToWrap[0].add(amountToWrap[1]).div(2);

        await catchCall(
            wrapper.methods
                .burn(accounts[4], osItemIds[0], amountToUnwrap, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[4],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DZRN_1_2.6 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DZRN_1_2.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[1],
                accounts[2],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    parallelItemIds[0],
                    "510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Insufficient amount"
        );

        // #UW_DZRN_1_2.7 END

        // #UW_DZRN_1_2.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[1],
                accounts[2],
                osKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    parallelItemIds[0],
                    "510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "invalid reserve"
        );

        // #UW_DZRN_1_2.8 END

        // #UW_DZRN_1_2.9 START

        var amountToBurn = "510000000000000000";

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[1],
                accounts[2],
                parallelKey,
                "0x",
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[3], parallelItemIds[0], amountToBurn, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            parallel,
            parallelTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToBurn.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToBurn.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, parallelTokenAddresss, parallelTokenId[1], parallelKey, wrapper, [1]);

        // #UW_DZRN_1_2.9 END

        // #UWB_DZRN_1_3.1 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osTokenAddresss, osTokenId[0], accounts[3], osKey, "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                osTokenAddresss,
                osTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [amountToWrap[0], amountToWrap[1].div(2)];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[4],
                [osItemIds[0], osItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        var amount = amountToUnWrap[0].add(amountToUnWrap[1]);

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amount,
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            amount.mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amount.mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, osTokenAddresss, osTokenId[0], osKey, wrapper, [amount]);

        // #UWB_DZRN_1_3.1 END
        // #BRN_DGODS_1_3.2 START

        var burnValue = "490000000000000000";

        erc20Contract = await asInteroperableInterface(parallelItemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            parallelItemIds[0],
            wrapper
        );
        // #BRN_DGODS_1_3.2 END
    });

    it("#2", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address     || amount               || Token Reference       || Lock
         * #W_APE_2_1.1              Wrap                Elite Ape             Acc1     Acc1, Acc1              3,4                     A,B                      yes,yes
         * #W_ADI_2_1.2              Wrap                Adidas                Acc2     Acc2, Acc5              3,1                     C,E                      yes,yes
         * #W_ADI_2_1.3              Wrap                Adidas                Acc3     Acc3                    3                       D                        yes
         *
         * #W_DAPE_2_1.4             MF: Wrap            DAPE                   Acc1    Acc1                    3                       A                        yes
         * #UW_DAPE_2_1.5            Unwrap              DAPE                   Acc1    Acc2                    1                       A                        yes
         * #TRA_DAPE_2_1.6           Transfer            DAPE                   Acc1    Acc2                    3                       //                       //
         * #UW_DAPE_2_1.7            Unwrap              DAPE                   Acc1    Acc2                    2                       A                        yes
         * #UW_DADI_2_1.8            MF: Unwrap          DADI                   Acc3    Acc3                    3                       C                        yes
         * #UW_DAPE_2_1.9            MF: Unwrap          DAPE                   Acc1    Acc1                    1                       B (passing D key)        yes
         * #TRA_DADI_2_2.1           Transfer            DADI                   Acc2    Acc3                    3                       //                       //
         * #UWB_ADI_2_2.2            MF: Unwrap Batch    DADI                   Acc3    Acc3                    3,3                     C,D                      yes,yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UWB_DADI_2_2.3           Unwrap Batch        DADI                   Acc3    Acc3                    3,3                     C,D                      yes,yes
         * #UW_DAPE_2_2.4            Unwrap              DAPE                   Acc2    Acc3                    3                       B                        yes
         */
        var tokenHolderElite = "0x6cd2d84298f731fa443061255a9a84a09dbca769";

        var eliteAddresss = "0xd0B53410454370a482979C0adaf3667c6308a801";

        var eliteTokenId = ["0"];

        var elite = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            eliteAddresss
        );

        await approveHost(tokenHolderElite);

        await Promise.all(
            eliteTokenId.map(async (id, index) => {
                await elite.methods
                    .safeTransferFrom(
                        tokenHolderElite,
                        accounts[1],
                        id,
                        7,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderElite,
                        })
                    );
            })
        );

        await elite.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #W_APE_2_1.1 START

        var amountToWrap = [3, 4];
        var createItem = await wrapperResource.generateCreateItem(
            [eliteTokenId[0], eliteTokenId[0]],
            [accounts[1], accounts[1]],
            [eliteAddresss, eliteAddresss],
            amountToWrap
        );

        var lock = [true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var eliteItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var eliteKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0].add(amountToWrap[1]),
            elite,
            eliteTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            eliteItemIds[0],
            wrapper
        );

        // #W_APE_2_1.1 END

        var tokenHolderAdidas = "0x41e8bf3d9288eddacc3206f9ab21b61a1c59df31";

        var adidasTokenAddresss = "0x28472a58a490c5e09a238847f66a68a47cc76f0f";

        var adidasTokenId = ["0"];

        var adidas = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            adidasTokenAddresss
        );

        await approveHost(tokenHolderAdidas);

        await adidas.methods
            .safeTransferFrom(
                tokenHolderAdidas,
                accounts[2],
                adidasTokenId[0],
                4,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderAdidas,
                })
            );

        await adidas.methods
            .safeTransferFrom(
                tokenHolderAdidas,
                accounts[3],
                adidasTokenId[0],
                3,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderAdidas,
                })
            );

        // #W_ADI_2_1.2 START

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [
                ["1", "1", "1", "1"],
                [accounts[2], accounts[2], accounts[2], accounts[5]],
                true,
            ]
        );

        var amountToWrap = "4";

        tx = await adidas.methods
            .safeTransferFrom(
                accounts[2],
                wrapper.options.address,
                adidasTokenId[0],
                amountToWrap,
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var adidasItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var adidasKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[2],
            wrapper.options.address,
            amountToWrap,
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "3000000000000000000",
            adidasItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[5],
            "1000000000000000000",
            adidasItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap, 0),
            adidasItemIds[0],
            wrapper
        );

        // #W_ADI_2_1.2 END

        // #W_ADI_2_1.3 START

        await adidas.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amountToWrap = ["3"];

        var createItem = await wrapperResource.generateCreateItem(
            [adidasTokenId[0]],
            [accounts[3]],
            [adidasTokenAddresss],
            amountToWrap
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var adidasKey2 = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0],
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amountToWrap[0], 0),
            adidasItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            adidasItemIds[0],
            wrapper
        );

        // #W_ADI_2_1.3 END

        var tokenHolderElite2 = "0x6cd2d84298f731fa443061255a9a84a09dbca769";

        await approveHost(tokenHolderElite2);

        await Promise.all(
            eliteTokenId.map(async (id, index) => {
                await elite.methods
                    .safeTransferFrom(
                        tokenHolderElite2,
                        accounts[1],
                        id,
                        3,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderElite2,
                        })
                    );
            })
        );

        // #W_DAPE_2_1.4 START

        var amountToWrap = [3];
        var createItem = await wrapperResource.generateCreateItem(
            [eliteTokenId[0]],
            [accounts[1]],
            [eliteAddresss],
            amountToWrap
        );

        var lock = [true];

        await catchCall(
            wrapper.methods.mintItems(createItem, lock).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            "already reserved"
        );

        // #W_DAPE_2_1.4 END

        // #UW_DAPE_2_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[2], eliteKey, "0x"]
        );

        var amountToUnwrap = "1000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], eliteItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            amountToUnwrap[0],
            elite,
            eliteTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        // #UW_DAPE_2_1.5 END

        // #TRA_DAPE_2_1.6 START

        wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                eliteItemIds[0],
                "3000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        // #TRA_DAPE_2_1.6 END

        // #UW_DAPE_2_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[2], eliteKey, "0x"]
        );

        var amountToUnwrap = "2000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], eliteItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            amountToUnwrap[0],
            elite,
            eliteTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, eliteAddresss, eliteTokenId[0], [eliteKey[0]], wrapper, [amountToUnwrap[0]]);

        // #UW_DAPE_2_1.7 END

        // #UW_DADI_2_1.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    adidasItemIds[0],
                    "3000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DADI_2_1.8 END

        // #UW_DAPE_2_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[1], adidasKey, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], eliteItemIds[0], "1000000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "invalid reserve"
        );

        // #UW_DAPE_2_1.9 END

        // #TRA_DADI_2_2.1 START

        wrapper.methods
            .safeTransferFrom(
                accounts[2],
                accounts[3],
                adidasItemIds[0],
                "3000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        // #TRA_DADI_2_2.1 END

        // #UWB_ADI_2_2.2 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey,
                "0x",
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey2,
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = ["3000000000000000000", "3000000000000000000"];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [adidasItemIds[0], adidasItemIds[0]],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "cannot unlock"
        );

        // #UWB_ADI_2_2.2 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UWB_DADI_2_2.3 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey,
                "0x",
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasTokenAddresss,
                adidasTokenId[0],
                accounts[3],
                adidasKey2,
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = ["3000000000000000000", "3000000000000000000"];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [adidasItemIds[0], adidasItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amount = amountToUnWrap[0].add(amountToUnWrap[1]);

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            6,
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amount.mul(-1),
            adidasItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amount.mul(-1),
            adidasItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, adidasTokenAddresss, adidasTokenId[0], [adidasKey[0]], wrapper, [amountToUnWrap[0][0]]);

        // #UWB_DADI_2_2.3 END

        // #UW_DAPE_2_2.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [eliteAddresss, eliteTokenId[0], accounts[3], eliteKey, "0x"]
        );

        var amountToUnwrap = "3000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[2], eliteItemIds[0], amountToUnwrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnwrap[0],
            elite,
            eliteTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnwrap.mul(-1),
            eliteItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, eliteAddresss, eliteTokenId[0], [eliteKey[0]], wrapper, [3]);

        // #UW_DAPE_2_2.4 END
    });

    it("#3", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address     || amount               || Token Reference       || Lock
         * #W_OSS_3_1.1              Wrap                OpenSea Storefront     Acc1    Acc1, Acc1              1,1                     A,B                     yes,yes
         * #W_OSS_3_1.2              Wrap                OpenSea Storefront     Acc1    Acc3                    1                       C                       no
         *
         * #UW_DOSS_3_1.3            MF: Unwrap          DOSS                   Acc3    Acc1                    0.6                     C                        no
         * #UW_DOSS_3_1.4            MF:Unwrap           DOSS                   Acc3    Acc3                    1                       A                        yes
         * #UW_DOSS_3_1.5            Unwrap              DOSS                   Acc3    Acc1                    1                       C                        no
         * #UW_DOSS_3_1.6            Unwrap              DOSS                   Acc1    Acc1                    1                       B                        yes
         * #W_OSS_3_1.7              Wrap                OpenSea Storefront     Acc1    Acc1                    1                       B+                       yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DOSS_3_1.8            MF: Unwrap          DOSS                   Acc1    Acc1                    1                       B+(passing empty key)    no
         * #UW_DOSS_3_1.9            MF: Unwrap          DOSS                   Acc1    Acc1                    1                       B+(passing A key)        no
         * #UW_DOSS_3_2.1            MF: Unwrap          DOSS                   Acc1    Acc1                    0.7                     B+(passing empty key)    no
         * #UW_DOSS_3_2.2            MF: Unwrap          DOSS                   Acc1    Acc1                    0.7                     B+(passing B key)        no
         * #UW_DOSS_3_2.3            MF: Unwrap          DOSS                   Acc1    Acc1                    0.7                     B+(passing empty key)    no
         * #TRA_DOSS_3_2.4           Transfer            DOSS                   Acc1    Acc3                    1                       //                       //
         * #UW_DOSS_3_2.5            Unwrap              DOSS                   Acc3    Acc3                    1                       A                        yes
         * #UW_DOSS_3_2.6            MF: Unwrap          DOSS                   Acc1    Acc1                    0.4                     B+                       no
         * #UW_DOSS_3_2.7            Unwrap              DOSS                   Acc1    Acc1                    0.7                     B+                       no
         * #BRN_DOSS_3_2.8           Burn(Interop.)      DOSS                   Acc1    //                      0.3                     //                       //
         * #W_OSS_3_2.9              Wrap                OpenSea Storefront     Acc1    Acc3                    1                       C                        no
         */
        var tokenHolderOpensea = "0xeea89c8843e8beb56e411bb4cac6dbc2d937ee1d";

        var openseaAddresss = "0x495f947276749ce646f68ac8c248420045cb7b5e";

        var openseaTokenId = [
            "57410037754672571264739567782498400843114500082247629786531933482096386899969",
            "18024890227566502247768699122836641523078737603476603287028741122087903559780",
            "65423712643887032042488748359236551000215163492589935922997446439823617294532",
        ];

        var opensea = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            openseaAddresss
        );

        await approveHost(tokenHolderOpensea);

        await Promise.all(
            openseaTokenId.map(async (id, index) => {
                await opensea.methods
                    .safeTransferFrom(
                        tokenHolderOpensea,
                        accounts[1],
                        id,
                        1,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderOpensea,
                        })
                    );
            })
        );

        // #W_OSS_3_1.1 START

        var amountToWrap = ["1", "1"];

        var datas = [];

        datas[0] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap[0]], [accounts[1]], true]
        );
        datas[1] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap[1]], [accounts[1]], true]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        tx = await opensea.methods
            .safeBatchTransferFrom(
                accounts[1],
                wrapper.options.address,
                [openseaTokenId[0], openseaTokenId[1]],
                amountToWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var openseaItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var openseaKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            opensea,
            openseaTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[1],
            opensea,
            openseaTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            openseaItemIds[0],
            wrapper
        );

        // #W_OSS_3_1.1 END

        // #W_OSS_3_1.2 START

        await opensea.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amountToWrap = [1];
        var createItem = await wrapperResource.generateCreateItem(
            [openseaTokenId[2]],
            [accounts[3]],
            [openseaAddresss],
            amountToWrap
        );

        var lock = [false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var openseaItemIds2 = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            opensea,
            openseaTokenId[2]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amountToWrap[0], 0),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            openseaItemIds[0],
            wrapper
        );

        // #W_OSS_3_1.2 END

        // #UW_DOSS_3_1.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[2],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    openseaItemIds[0],
                    "600000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "amount"
        );

        // #UW_DOSS_3_1.3 END

        // #UW_DOSS_3_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [openseaAddresss, openseaTokenId[0], accounts[3], openseaKey, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    openseaItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "cannot unlock"
        );
        // #UW_DOSS_3_1.4 END

        // #UW_DOSS_3_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[2],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var amountToUnWrap = "1000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[3], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[0],
            opensea,
            openseaTokenId[2]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        // #UW_DOSS_3_1.5 END

        // #UW_DOSS_3_1.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[1],
                [openseaKey[1]],
                "0x",
            ]
        );

        var amountToUnWrap = "1000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[0],
            opensea,
            openseaTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, openseaAddresss, openseaTokenId[1], [openseaKey[1]], wrapper, [amountToUnWrap[0]]);

        await opensea.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #UW_DOSS_3_1.6 END

        // #W_OSS_3_1.7 START

        var amountToWrap = [1];
        var createItem = await wrapperResource.generateCreateItem(
            [openseaTokenId[1]],
            [accounts[1]],
            [openseaAddresss],
            amountToWrap
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var openseaKeyBPlus = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            opensea,
            openseaTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            openseaItemIds[0],
            wrapper
        );

        // #W_OSS_3_1.7 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DOSS_3_1.8 START
        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    openseaItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "insufficient amount"
        );
        // #UW_DOSS_3_1.8 END
        // #UW_DOSS_3_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[1],
                [openseaKey[0]],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    openseaItemIds[0],
                    "1000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "invalid reserve"
        );
        // #UW_DOSS_3_1.9 END
        // #UW_DOSS_3_2.1 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    openseaItemIds[0],
                    "700000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );
        // #UW_DOSS_3_2.1 END
        // #UW_DOSS_3_2.2 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[1],
                [openseaKey[0]],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    openseaItemIds[0],
                    "700000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );
        // #UW_DOSS_3_2.2 END
        // #UW_DOSS_3_2.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[1],
                [openseaKeyBPlus[0]],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    openseaItemIds[0],
                    "700000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );
        // #UW_DOSS_3_2.3 END

        // #TRA_DOSS_3_2.4 START

        await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[3],
                openseaItemIds[0],
                "1000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );
        // #TRA_DOSS_3_2.4 END

        // #UW_DOSS_3_2.5 START
        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[0],
                accounts[3],
                [openseaKey[0]],
                "0x",
            ]
        );

        var amountToUnWrap = "1000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[3], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[0],
            opensea,
            openseaTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, openseaAddresss, openseaTokenId[0], [openseaKey[0]], wrapper, [amountToUnWrap[0]]);

        // #UW_DOSS_3_2.5 END

        // #UW_DOSS_3_2.6 START
        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[3],
                openseaKeyBPlus,
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    openseaItemIds[0],
                    "400000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );
        // #UW_DOSS_3_2.6 END
        // #UW_DOSS_3_2.7 START
        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[1],
                openseaKeyBPlus,
                "0x",
            ]
        );

        var amountToUnWrap = "700000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            opensea,
            openseaTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, openseaAddresss, openseaTokenId[1], openseaKeyBPlus, wrapper, [1]);

        // #UW_DOSS_3_2.7 END

        // #BRN_DOSS_3_2.8 START
        var burnValue = "300000000000000000";

        erc20Contract = await asInteroperableInterface(openseaItemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            openseaItemIds[0],
            wrapper
        );
        // #BRN_DOSS_3_2.8 END
        // #W_OSS_3_2.9 START
        await opensea.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amountToWrap  = ["1"];

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap, [accounts[3]], false]
        );

        tx = await opensea.methods
            .safeTransferFrom(
                accounts[1],
                wrapper.options.address,
                openseaTokenId[2],
                amountToWrap[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            opensea,
            openseaTokenId[2]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amountToWrap[0], 0),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            openseaItemIds[0],
            wrapper
        );
        // #W_OSS_3_2.9 END

    });

    it("#4", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address     || amount               || Token Reference       || Lock
         * #W_OS_OH_4_1.1            Wrap                OS, Oh-oh-oh          Acc3     Acc3, Acc1              x, y                    A, B                     yes,yes
         * #W_iETH_4_1.2             Wrap                Ethereum item         Acc3     Acc3                    z                       C                        yes
         *
         * #UW_DOH_4_1.3             MF: Unwrap          DOH                    Acc1    Acc1                    y                       B                        yes
         * #UW_DOH_4_1.4             MF: Unwrap          DOH                    Acc1    Acc3                    y                       B(passing empty key)     yes
         * #UW_DOH_4_1.5             MF: Unwrap          DOH                    Acc1    Acc3                    y                       B(passing A key)         yes
         * #UW_DOH_4_1.6             MF: Unwrap          DOS                    Acc3    Acc3                    x                       A(passing empty key)     yes
         * #UW_DOH_4_1.7             MF: Unwrap          DOS                    Acc3    Acc3                    x                       A(passing B key)         yes
         * #UWB_DiWETH_DOS_4_1.8     Unwrap Batch        DiWETH,DOS             Acc3    Acc1                    x/2, z/2                A,C                      yes,yes
         * #W_OS_iWETH_4_1.9         Wrap                OS, iWETH              Acc1    Acc1, Acc1              x/2, z/2                A+, C+                   yes,yes
         * #UWB_DOS_DiWETH_DOH_4_2.1 MF: Unwrap Batch    DOS,DiWETH,DOH         Acc1    Acc3                    x/2, z/2,y              A+,C+,B                  yes,yes,yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UWB_DOS_DiWETH_DOH_4_2.2 Unwrap Batch        DOS,DiWETH,DOH         Acc1    Acc3                    x/2, z/2,y              A+,C+,B                  yes,yes,yes
         * #W_OS_iWETH_OH_4_2.3      Wrap                OS,iETH,Oh-oh-oh       Acc3    [(Acc3, Ac1),(Acc2,Acc5,Acc4),(Acc1,Acc7,Acc8,Acc9)]      [(x/4,x/4),(z/6,z/6,z/6),(y/4,y/4,y/4,y/4)]              A++, C++, B++                  no,no,no
         */
        var tokenHolderOs = "0x43126fb5e1fe86bb44b084d09f651358b97ebf0c";

        var osAddress = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var osTokenId = ["553791398095120659341456634783597180523460212593"];

        var os = new web3.eth.Contract(knowledgeBase.IERC1155ABI, osAddress);

        await Promise.all(
            osTokenId.map(async (id, index) => {
                await os.methods
                    .safeTransferFrom(
                        accounts[4],
                        tokenHolderOs,
                        id,
                        await os.methods
                            .balanceOf(accounts[4], osTokenId[0])
                            .call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[4],
                        })
                    );
            })
        );

        var osAmount = await os.methods
            .balanceOf(tokenHolderOs, osTokenId[0])
            .call();

        await approveHost(tokenHolderOs);

        await Promise.all(
            osTokenId.map(async (id, index) => {
                await os.methods
                    .safeTransferFrom(
                        tokenHolderOs,
                        accounts[3],
                        id,
                        osAmount,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderOs,
                        })
                    );
            })
        );

        var tokenHolderHo = "0xf1fced5b0475a935b49b95786adbda2d40794d2d";

        var hoAddress = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var hoTokenId = ["578341054725116502893129430711564539037968047002"];

        var ho = new web3.eth.Contract(knowledgeBase.IERC1155ABI, hoAddress);

        var hoAmount = await ho.methods
            .balanceOf(tokenHolderHo, hoTokenId[0])
            .call();

        await approveHost(tokenHolderHo);

        await ho.methods
            .safeTransferFrom(
                tokenHolderHo,
                accounts[3],
                hoTokenId[0],
                hoAmount,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderHo,
                })
            );

        // #W_OS_OH_4_1.1 START

        var datas = [];

        datas[0] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[osAmount], [accounts[3]], true]
        );
        datas[1] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[hoAmount], [accounts[1]], true]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        tx = await ho.methods
            .safeBatchTransferFrom(
                accounts[3],
                wrapper.options.address,
                [osTokenId[0], hoTokenId[0]],
                [osAmount, hoAmount],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
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

        var keys = (await getKeyFromEvent(tx)).key;

        var hoItemIds = [itemIds[1]];

        var hoKeys = [keys[1]];

        var osItemIds = [itemIds[0]];
        var osKeys = [keys[0]];

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            osAmount,
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            osAmount,
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(tx, osAmount, osItemIds[0], wrapper);

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            hoAmount,
            ho,
            hoTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            hoAmount,
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(tx, hoAmount, hoItemIds[0], wrapper);

        // #W_OS_OH_4_1.1 END

        var tokenHolderWeth = "0xa9b95d7b0dc294078d8c61507460342045e6d5c4";

        var wethTokenAddresss = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var wethTokenId = ["424598707882341362120214388976627581791055360979"];

        var weth = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            wethTokenAddresss
        );

        var wethAmount = (
            await weth.methods.balanceOf(tokenHolderWeth, wethTokenId[0]).call()
        ).div(2);

        await approveHost(tokenHolderWeth);

        await weth.methods
            .safeTransferFrom(
                tokenHolderWeth,
                accounts[3],
                wethTokenId[0],
                wethAmount,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderWeth,
                })
            );

        await weth.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        // #W_iETH_4_1.2 START

        var amountToWrap = [wethAmount];
        var createItem = await wrapperResource.generateCreateItem(
            [wethTokenId[0]],
            [accounts[3]],
            [wethTokenAddresss],
            amountToWrap
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var wethItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var wethKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToWrap[0],
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[0],
            wethItemIds[0],
            wrapper
        );

        // #W_iETH_4_1.2 END

        // #UW_DOH_4_1.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[1], hoKeys, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], hoItemIds[0], hoAmount, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DOH_4_1.3 END

        // #UW_DOH_4_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                hoAddress,
                hoTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods.burn(accounts[1], hoItemIds[0], hoAmount, data).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            "insufficient amount"
        );

        // #UW_DOH_4_1.4 END
        // #UW_DOH_4_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[3], osKeys, "0x"]
        );

        await catchCall(
            wrapper.methods.burn(accounts[1], hoItemIds[0], 300, data).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            "invalid reserve"
        );
        // #UW_DOH_4_1.5 END
        // #UW_DOH_4_1.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                osAddress,
                osTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], osItemIds[0], osAmount, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "insufficient amount"
        );
        // #UW_DOH_4_1.6 END

        // #UW_DOH_4_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[3], hoKeys, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], osItemIds[0], osAmount, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "invalid reserve"
        );

        // #UW_DOH_4_1.7 END

        // #UWB_DiWETH_DOS_4_1.8 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [wethTokenAddresss, wethTokenId[0], accounts[1], [wethKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[1], [osKeys[0]], "0x"]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [wethAmount.div(2), osAmount.div(2)];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [wethItemIds[0], osItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[0],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[1],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap[0].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap[1].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, wethTokenAddresss, wethTokenId[0], [wethKey[0]], wrapper, [amountToUnWrap[0]]);
        await wrapperResource.checkUnlockedAmount(tx, osAddress, osTokenId[0], [osKeys[0]], wrapper, [amountToUnWrap[1]]);

        await os.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await weth.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #UWB_DiWETH_DOS_4_1.8 END

        // #W_OS_iWETH_4_1.9 START

        var amountToWrap = [osAmount.div(2), wethAmount.div(2)];
        var createItem = await wrapperResource.generateCreateItem(
            [osTokenId[0], wethTokenId[0]],
            [accounts[1], accounts[1]],
            [osAddress, wethTokenAddresss],
            amountToWrap
        );

        var lock = [true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var key2 = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[1],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap[0],
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap[1],
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[0],
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[1],
            wethItemIds[0],
            wrapper
        );

        // #W_OS_iWETH_4_1.9 END

        // #UWB_DOS_DiWETH_DOH_4_2.1 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[3], [key2[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[3], [hoKeys[0]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [wethTokenAddresss, wethTokenId[0], accounts[3], [key2[1]], "0x"]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [osAmount.div(2), hoAmount, wethAmount.div(2)];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [osItemIds[0], hoItemIds[0], wethItemIds[0]],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "cannot unlock"
        );

        // #UWB_DOS_DiWETH_DOH_4_2.1 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UWB_DOS_DiWETH_DOH_4_2.2 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[3], [key2[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[3], [hoKeys[0]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [wethTokenAddresss, wethTokenId[0], accounts[3], [key2[1]], "0x"]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [osAmount.div(2), hoAmount, wethAmount.div(2)];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [osItemIds[0], hoItemIds[0], wethItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[2],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[0],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[1],
            ho,
            hoTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[2].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[0].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[1].mul(-1),
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[2].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, osAddress, osTokenId[0], [key2[0]], wrapper, [amountToUnWrap[0]]);
        await wrapperResource.checkUnlockedAmount(tx, hoAddress, hoTokenId[0], [hoKeys[0]], wrapper, [amountToUnWrap[1]]);
        await wrapperResource.checkUnlockedAmount(tx, wethTokenAddresss, wethTokenId[0], [key2[1]], wrapper, [amountToUnWrap[2]]);

        // #UWB_DOS_DiWETH_DOH_4_2.2 END

        // #W_OS_iWETH_OH_4_2.3 START
        var datas = [];

        var amountToWrap0 = [osAmount.div(4), osAmount.div(4)];
        var amountToWrap1 = [hoAmount.div(6), hoAmount.div(6), hoAmount.div(6)];
        var amountToWrap2 = [
            wethAmount.div(8),
            wethAmount.div(8),
            wethAmount.div(8),
            wethAmount.div(8),
        ];

        var address0 = [accounts[3], accounts[1]];
        var address1 = [accounts[2], accounts[5], accounts[4]];
        var address2 = [accounts[1], accounts[7], accounts[8], accounts[9]];

        datas[0] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap0, address0, false]
        );
        datas[1] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap1, address1, false]
        );
        datas[2] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap2, address2, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        tx = await os.methods
            .safeBatchTransferFrom(
                accounts[3],
                wrapper.options.address,
                [osTokenId[0], hoTokenId[0], wethTokenId[0]],
                [
                    amountToWrap0[0].add(amountToWrap0[1]),
                    amountToWrap1[0]
                        .add(amountToWrap1[1])
                        .add(amountToWrap1[2]),
                    amountToWrap2[0]
                        .add(amountToWrap2[1])
                        .add(amountToWrap2[2])
                        .add(amountToWrap2[3]),
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap0[0].add(amountToWrap0[1]),
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap1[0].add(amountToWrap1[1]).add(amountToWrap1[2]),
            ho,
            hoTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap2[0]
                .add(amountToWrap2[1])
                .add(amountToWrap2[2])
                .add(amountToWrap2[3]),
            weth,
            wethTokenId[0]
        );

        await Promise.all(
            amountToWrap0.map(async (amount, index) => {
                await wrapperResource.checkBalanceItem(
                    tx,
                    address0[index],
                    amount,
                    osItemIds[0],
                    wrapper
                );
            })
        );

        await Promise.all(
            amountToWrap1.map(async (amount, index) => {
                await wrapperResource.checkBalanceItem(
                    tx,
                    address1[index],
                    amount,
                    hoItemIds[0],
                    wrapper
                );
            })
        );

        await Promise.all(
            amountToWrap2.map(async (amount, index) => {
                await wrapperResource.checkBalanceItem(
                    tx,
                    address2[index],
                    amount,
                    wethItemIds[0],
                    wrapper
                );
            })
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap0[0].add(amountToWrap0[1]),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap1[0].add(amountToWrap1[1]).add(amountToWrap1[2]),
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap2[0]
                .add(amountToWrap2[1])
                .add(amountToWrap2[2])
                .add(amountToWrap2[3]),
            wethItemIds[0],
            wrapper
        );
        // #W_OS_iWETH_OH_4_2.3 END
    });

    it("#4b", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address     || amount               || Token Reference       || Lock
         * #W_OS_OH_4b_1.1            Wrap                OS, Oh-oh-oh          Acc3     Acc3, Acc1              x, y                    A, B                     yes,yes
         * #W_iETH_4b_1.2             Wrap                Ethereum item         Acc3     Acc3                    z                       C                        yes
         *
         * #UW_DOH_4b_1.3             MF: Unwrap          DOH                    Acc1    Acc1                    y                       B                        yes
         * #UW_DOH_4b_1.4             MF: Unwrap          DOH                    Acc1    Acc3                    x                       B(passing empty key)     yes
         * #UW_DOH_4b_1.5             MF: Unwrap          DOH                    Acc1    Acc3                    x                       B(passing A key)         yes
         * #UW_DOH_4b_1.6             MF: Unwrap          DOS                    Acc3    Acc3                    x                       A(passing empty key)     yes
         * #UW_DOH_4b_1.7             MF: Unwrap          DOS                    Acc3    Acc3                    x                       A(passing B key)         yes
         * #UWB_DiWETH_DOS_4b_1.8     Unwrap Batch        DiWETH,DOS             Acc3    Acc1                    x/2, z/2                A,C                      yes,yes
         * #W_OS_iWETH_4b_1.9         Wrap                OS, iWETH              Acc1    Acc1, Acc1              x/2, z/2                A+, C+                   yes,yes
         * #UWB_DOS_DiWETH_DOH_4b_2.1 MF: Unwrap Batch    DOS,DiWETH,DOH         Acc1    Acc3                    x/2, z/2,y              A+,C+,B                  yes,yes,yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UWB_DOS_DiWETH_DOH_4b_2.2 Unwrap Batch        DOS,DiWETH,DOH         Acc1    Acc3                    x/2, z/2,y              A+,C+,B                  yes,yes,yes
         * #W_OS_iWETH_OH_4b_2.3      Wrap                OS,iETH,Oh-oh-oh       Acc3    Accc3                   x/2,z/2,y               A++, C++, B++            no,no,no
         */
        var tokenHolderOs = "0x43126fb5e1fe86bb44b084d09f651358b97ebf0c";

        var osAddress = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var osTokenId = ["553791398095120659341456634783597180523460212593"];

        var os = new web3.eth.Contract(knowledgeBase.IERC1155ABI, osAddress);

        await Promise.all(
            osTokenId.map(async (id, index) => {
                await os.methods
                    .safeTransferFrom(
                        accounts[4],
                        tokenHolderOs,
                        id,
                        await os.methods
                            .balanceOf(accounts[4], osTokenId[0])
                            .call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[4],
                        })
                    );
            })
        );

        var osAmount = await os.methods
            .balanceOf(tokenHolderOs, osTokenId[0])
            .call();

        await approveHost(tokenHolderOs);

        await Promise.all(
            osTokenId.map(async (id, index) => {
                await os.methods
                    .safeTransferFrom(
                        tokenHolderOs,
                        accounts[3],
                        id,
                        osAmount,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderOs,
                        })
                    );
            })
        );

        var tokenHolderHo = "0xf1fced5b0475a935b49b95786adbda2d40794d2d";

        var hoAddress = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var hoTokenId = ["578341054725116502893129430711564539037968047002"];

        var ho = new web3.eth.Contract(knowledgeBase.IERC1155ABI, hoAddress);

        var hoAmount = await ho.methods
            .balanceOf(tokenHolderHo, hoTokenId[0])
            .call();

        await approveHost(tokenHolderHo);

        await ho.methods
            .safeTransferFrom(
                tokenHolderHo,
                accounts[3],
                hoTokenId[0],
                hoAmount,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderHo,
                })
            );

        // #W_OS_OH_4b_1.1 START

        var datas = [];

        datas[0] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[osAmount], [accounts[3]], true]
        );
        datas[1] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[hoAmount], [accounts[1]], true]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        tx = await ho.methods
            .safeBatchTransferFrom(
                accounts[3],
                wrapper.options.address,
                [osTokenId[0], hoTokenId[0]],
                [osAmount, hoAmount],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
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

        var keys = (await getKeyFromEvent(tx)).key;

        var hoItemIds = [itemIds[1]];

        var hoKeys = [keys[1]];

        var osItemIds = [itemIds[0]];
        var osKeys = [keys[0]];

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            osAmount,
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            osAmount,
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(tx, osAmount, osItemIds[0], wrapper);

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            hoAmount,
            ho,
            hoTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            hoAmount,
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(tx, hoAmount, hoItemIds[0], wrapper);

        // #W_OS_OH_4b_1.1 END

        var tokenHolderWeth = "0xa9b95d7b0dc294078d8c61507460342045e6d5c4";

        var wethTokenAddresss = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var wethTokenId = ["424598707882341362120214388976627581791055360979"];

        var weth = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            wethTokenAddresss
        );

        var wethAmount = (
            await weth.methods.balanceOf(tokenHolderWeth, wethTokenId[0]).call()
        ).div(2);

        await approveHost(tokenHolderWeth);

        await weth.methods
            .safeTransferFrom(
                tokenHolderWeth,
                accounts[3],
                wethTokenId[0],
                wethAmount,
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: tokenHolderWeth,
                })
            );

        await weth.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        // #W_iETH_4b_1.2 START

        var amountToWrap = [wethAmount];
        var createItem = await wrapperResource.generateCreateItem(
            [wethTokenId[0]],
            [accounts[3]],
            [wethTokenAddresss],
            amountToWrap
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var wethItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var wethKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToWrap[0],
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[0],
            wethItemIds[0],
            wrapper
        );

        // #W_iETH_4b_1.2 END

        // #UW_DOH_4b_1.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[1], hoKeys, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], hoItemIds[0], hoAmount, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DOH_4b_1.3 END

        // #UW_DOH_4b_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                hoAddress,
                hoTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods.burn(accounts[1], hoItemIds[0], hoAmount, data).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            "insufficient amount"
        );

        // #UW_DOH_4b_1.4 END
        // #UW_DOH_4b_1.5 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[3], osKeys, "0x"]
        );

        await catchCall(
            wrapper.methods.burn(accounts[1], hoItemIds[0], 300, data).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            "invalid reserve"
        );
        // #UW_DOH_4b_1.5 END
        // #UW_DOH_4b_1.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                osAddress,
                osTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], osItemIds[0], osAmount, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "insufficient amount"
        );
        // #UW_DOH_4b_1.6 END

        // #UW_DOH_4b_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[3], hoKeys, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[3], osItemIds[0], osAmount, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "invalid reserve"
        );

        // #UW_DOH_4b_1.7 END

        // #UWB_DiWETH_DOS_4b_1.8 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [wethTokenAddresss, wethTokenId[0], accounts[1], [wethKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[1], [osKeys[0]], "0x"]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [wethAmount.div(2), osAmount.div(2)];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [wethItemIds[0], osItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[0],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[1],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap[0].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap[1].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, wethTokenAddresss, wethTokenId[0], [wethKey[0]], wrapper, [amountToUnWrap[0]]);
        await wrapperResource.checkUnlockedAmount(tx, osAddress, osTokenId[0], [osKeys[0]], wrapper, [amountToUnWrap[1]]);

        await os.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await weth.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #UWB_DiWETH_DOS_4b_1.8 END

        // #W_OS_iWETH_4b_1.9 START

        var amountToWrap = [osAmount.div(2), wethAmount.div(2)];
        var createItem = await wrapperResource.generateCreateItem(
            [osTokenId[0], wethTokenId[0]],
            [accounts[1], accounts[1]],
            [osAddress, wethTokenAddresss],
            amountToWrap
        );

        var lock = [true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var key2 = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[1],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap[0],
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToWrap[1],
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[0],
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[1],
            wethItemIds[0],
            wrapper
        );

        // #W_OS_iWETH_4b_1.9 END

        // #UWB_DOS_DiWETH_DOH_4b_2.1 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[3], [key2[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[3], [hoKeys[0]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [wethTokenAddresss, wethTokenId[0], accounts[3], [key2[1]], "0x"]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [osAmount.div(2), hoAmount, wethAmount.div(2)];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [osItemIds[0], hoItemIds[0], wethItemIds[0]],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "cannot unlock"
        );

        // #UWB_DOS_DiWETH_DOH_4b_2.1 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UWB_DOS_DiWETH_DOH_4b_2.2 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osAddress, osTokenId[0], accounts[3], [key2[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [hoAddress, hoTokenId[0], accounts[3], [hoKeys[0]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [wethTokenAddresss, wethTokenId[0], accounts[3], [key2[1]], "0x"]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [osAmount.div(2), hoAmount, wethAmount.div(2)];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [osItemIds[0], hoItemIds[0], wethItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[2],
            weth,
            wethTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[0],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amountToUnWrap[1],
            ho,
            hoTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[2].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[0].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[1].mul(-1),
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[2].mul(-1),
            wethItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, osAddress, osTokenId[0], [key2[0]], wrapper, [amountToUnWrap[0]]);
        await wrapperResource.checkUnlockedAmount(tx, hoAddress, hoTokenId[0], [hoKeys[0]], wrapper, [amountToUnWrap[1]]);
        await wrapperResource.checkUnlockedAmount(tx, wethTokenAddresss, wethTokenId[0], [key2[1]], wrapper, [amountToUnWrap[2]]);

        // #UWB_DOS_DiWETH_DOH_4b_2.2 END

        // #W_OS_iWETH_OH_4b_2.3 START
        var datas = [];

        var amountToWrap0 = [osAmount.div(2)];
        var amountToWrap1 = [hoAmount.div(2)];
        var amountToWrap2 = [
            wethAmount.div(2)
        ];

        var address0 = [accounts[3]];
        var address1 = [accounts[3]];
        var address2 = [accounts[3]];

        datas[0] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap0, address0, false]
        );
        datas[1] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap1, address1, false]
        );
        datas[2] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap2, address2, false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        tx = await os.methods
            .safeBatchTransferFrom(
                accounts[3],
                wrapper.options.address,
                [osTokenId[0], hoTokenId[0], wethTokenId[0]],
                [
                    amountToWrap0[0],
                    amountToWrap1[0],
                    amountToWrap2[0],
                ],
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap0[0],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap1[0],
            ho,
            hoTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap2[0],
            weth,
            wethTokenId[0]
        );

        await Promise.all(
            amountToWrap0.map(async (amount, index) => {
                await wrapperResource.checkBalanceItem(
                    tx,
                    address0[index],
                    amount,
                    osItemIds[0],
                    wrapper
                );
            })
        );

        await Promise.all(
            amountToWrap1.map(async (amount, index) => {
                await wrapperResource.checkBalanceItem(
                    tx,
                    address1[index],
                    amount,
                    hoItemIds[0],
                    wrapper
                );
            })
        );

        await Promise.all(
            amountToWrap2.map(async (amount, index) => {
                await wrapperResource.checkBalanceItem(
                    tx,
                    address2[index],
                    amount,
                    wethItemIds[0],
                    wrapper
                );
            })
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap0[0],
            osItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap1[0],
            hoItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap2[0],
            wethItemIds[0],
            wrapper
        );
        // #W_OS_iWETH_OH_4b_2.3 END
    });

    it("#5", async () => {
        /**
         * Label                ||   Operation        || Token              || From  || Receiver address     || amount               || Token Reference       || Lock
         * #W_ZAP_5_1.1              Wrap                Zapper                 Acc1    Acc1                    3,4,5                   A, B, C                  yes,yes,yes
         *
         * #TRA_DZAP_5_1.2           Transfer            DZAP                   Acc1    Acc2                    6                       //                       //
         * #UWB_DZAP_5_1.3           MF: Unwrap Batch    DZAP                   Acc2    Acc2                    1,2,3                   A,B,C                    yes,yes,yes
         * #UWB_DZAP_5_1.4           Unwrap Batch        DZAP                   Acc1    Acc3                    1,2,3                   A,B,C                    yes,yes,yes
         * #W_ZAP_5_1.5              Wrap                Zapper                 Acc3    Acc2                    1,2,3                   A+, B+, C+               no,yes,no
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UWB_DZAP_5_1.6           MF: Unwrap Batch    DZAP                   Acc2    Acc1                    0.51,2,3                A,C,B+                   yes,yes,yes
         * #UWB_DZAP_5_1.7           Unwrap Batch        DZAP                   Acc2    Acc1                    1,2,3                   A,C,B+                   yes,yes,yes
         * #UWB_DZAP_5_1.8           Unwrap Batch        DZAP                   Acc2    Acc1                    1,2,2,0.51              A+,B,C+,C+               no,yes,no,no
         * #BRN_DZAP_5_1.9           Burn(Interop.)      DZAP                   Acc2    //                      0.49                    //                       //
         */
        var tokenHolderZapper = "0xdcd299415efc9717564c6f23ccce25b5dbfec335";

        var zapperAddress = "0xF1F3ca6268f330fDa08418db12171c3173eE39C9";

        var zapperTokenId = ["15"];

        var zapper = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zapperAddress
        );

        await approveHost(tokenHolderZapper);

        await Promise.all(
            zapperTokenId.map(async (id, index) => {
                await zapper.methods
                    .safeTransferFrom(
                        tokenHolderZapper,
                        accounts[1],
                        id,
                        12,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderZapper,
                        })
                    );
            })
        );

        // #W_ZAP_5_1.1 START

        await zapper.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amountToWrap = ["3", "4", "5"];

        var createItem = await wrapperResource.generateCreateItem(
            [zapperTokenId[0], zapperTokenId[0], zapperTokenId[0]],
            [accounts[1], accounts[1], accounts[1]],
            [zapperAddress, zapperAddress, zapperAddress],
            amountToWrap
        );

        var lock = [true, true, true];
        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var zapperItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var zapperKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]),
            zapper,
            zapperTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]), 0),
            zapperItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]), 0),
            zapperItemIds[0],
            wrapper
        );

        // #W_ZAP_5_1.1 END

        // #TRA_DZAP_5_1.2 START

        await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                zapperItemIds[0],
                "6000000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #TRA_DZAP_5_1.2 END

        // #UWB_DZAP_5_1.3 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[2], [zapperKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[2], [zapperKey[1]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[2], [zapperKey[2]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "1000000000000000000",
            "2000000000000000000",
            "3000000000000000000",
        ];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[2],
                    [zapperItemIds[0], zapperItemIds[0], zapperItemIds[0]],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Cannot unlock"
        );

        // #UWB_DZAP_5_1.3 END

        // #UWB_DZAP_5_1.4 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[3], [zapperKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[3], [zapperKey[1]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[3], [zapperKey[2]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "1000000000000000000",
            "2000000000000000000",
            "3000000000000000000",
        ];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [zapperItemIds[0], zapperItemIds[0], zapperItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amount = "6000000000000000000";

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            amount[0],
            zapper,
            zapperTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amount.mul(-1),
            zapperItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amount.mul(-1),
            zapperItemIds[0],
            wrapper
        );

        // #UWB_DZAP_5_1.4 END

        // #W_ZAP_5_1.5 START

        await zapper.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amountToWrap = ["1", "2", "3"];

        var createItem = await wrapperResource.generateCreateItem(
            [zapperTokenId[0], zapperTokenId[0], zapperTokenId[0]],
            [accounts[2], accounts[2], accounts[2]],
            [zapperAddress, zapperAddress, zapperAddress],
            amountToWrap
        );

        var lock = [false, true, false];
        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var zapperKeyPlus = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]),
            zapper,
            zapperTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]), 0),
            zapperItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]), 0),
            zapperItemIds[0],
            wrapper
        );

        // #W_ZAP_5_1.5 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UWB_DZAP_5_1.6 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[1], [zapperKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[0], accounts[1], [zapperKey[2]], "0x"]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[1],
                [zapperKeyPlus[0]],
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "510000000000000000",
            "2000000000000000000",
            "3000000000000000000",
        ];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[2],
                    [zapperItemIds[0], zapperItemIds[0], zapperItemIds[0]],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "amount"
        );

        // #UWB_DZAP_5_1.6 END

        // #UWB_DZAP_5_1.7 START

        var amountToUnWrap = [
            "1000000000000000000",
            "2000000000000000000",
            "3000000000000000000",
        ];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[2],
                [zapperItemIds[0], zapperItemIds[0], zapperItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amount = "6000000000000000000";

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amount[0],
            zapper,
            zapperTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amount.mul(-1),
            zapperItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amount.mul(-1),
            zapperItemIds[0],
            wrapper
        );

        // #UWB_DZAP_5_1.7 END

        // #UWB_DZAP_5_1.8 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[3] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "1000000000000000000",
            "2000000000000000000",
            "2000000000000000000",
            "510000000000000000",
        ];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[2],
                [
                    zapperItemIds[0],
                    zapperItemIds[0],
                    zapperItemIds[0],
                    zapperItemIds[0],
                ],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amount = "5510000000000000000";

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            6,
            zapper,
            zapperTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amount.mul(-1),
            zapperItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amount.mul(-1),
            zapperItemIds[0],
            wrapper
        );

        // #UWB_DZAP_5_1.8 END
        // #BRN_DOSS_5_1.9 START

        var burnValue = "490000000000000000";

        erc20Contract = await asInteroperableInterface(zapperItemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            zapperItemIds[0],
            wrapper
        );
        // #BRN_DOSS_5_1.9 END
    });

    it("#6", async () => {
        /**
         * Label                       ||   Operation        || Token                    || From  || Receiver address ||amount                                      || Token Reference                  || Lock
         * #W_ZRN_6_1.1                     Wrap                Zerion                      Acc3     Acc3                4,4,4                                         A,B,C                               yes,no,yes
         * #W_ZAP_iERC20_6_1.2              Wrap                Zapper,iERC20 item          Acc3     Acc3                3,3,x,y                                       D,E,F,G                             no,yes,yes,yes
         *
         * #UWB_DZRN_DZAP_DiERC20_6_1.3     Unwrap Batch        DZRN,DZAP,DiERC20           Acc3     Acc2                2,2,2,1,1,x/2,y/2                             A,B,C,D,E,F,G                       yes,no, yes,no,yes,yes,yes
         * #W_ZRN_ZAP_iERC20_6_1.4          Wrap                Zerion,Zapper,iERC20 item   Acc2     Acc3                2,2,2,1,1,x/2,y/2                             A+,B+,C+,D+,E+,F+,G+                no,no,no,no,no,no,no
         * #UWB_DZRN_DZAP_DiERC20_6_1.5     Unwrap Batch        DZRN,DZAP,DiERC20           Acc3     Acc1                2,2,2,2,2,x/2,y/2,2,2,2,1,1,x/2,y/2           A,B,C,D,E,F,G,A+,B+,C+,D+,E+,F+,G+  yes,no, yes,no,yes,yes,yes,no,no,no,no,no,no,no
         * #W_ZRN_ZAP_iERC20_6_1.6          Wrap                Zerion,Zapper,iERC20 item   Acc1     Acc1                4,4,4,3,3,x,y                                 A++,B++,C++,D++,E++,F++,G++         yes,no,yes,no,yes,no,yes
         * #UWB_DZRN_DZAP_DiERC20_6_1.7     MF:Unwrap Batch     DZRN,DZAP,DiERC20           Acc3     Acc1                4,4,4,3,3,x,y                                 A++,B++,C++,D++,E++,F++,G++         yes,no,yes,no,yes,no,yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UWB_DZRN_DZAP_DiERC20_6_1.8     Unwrap Batch        DZRN,DZAP,DiERC20           Acc3     Acc1                4,4,4,3,3,x,y                                 A++,B++,C++,D++,E++,F++,G++         yes,no,yes,no,yes,no,yes
         */
        var tokenHolderZerion = "0xecde04e088828c93a1003b9388727a25c064e5e3";

        var zerionAddress = "0x74EE68a33f6c9f113e22B3B77418B75f85d07D22";

        var zerionTokenId = ["10", "2", "5"];

        var zerion = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zerionAddress
        );

        await approveHost(tokenHolderZerion);

        await Promise.all(
            zerionTokenId.map(async (id, index) => {
                await zerion.methods
                    .safeTransferFrom(
                        accounts[1],
                        tokenHolderZerion,
                        id,
                        await zerion.methods.balanceOf(accounts[1], id).call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[1],
                        })
                    );

                await zerion.methods
                    .safeTransferFrom(
                        accounts[4],
                        tokenHolderZerion,
                        id,
                        await zerion.methods.balanceOf(accounts[4], id).call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[4],
                        })
                    );

                await zerion.methods
                    .safeTransferFrom(
                        tokenHolderZerion,
                        accounts[3],
                        id,
                        4,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderZerion,
                        })
                    );
            })
        );

        // #W_ZRN_6_1.1 START

        var amountToWrap = [4, 4, 4];

        var datas = [];

        datas[0] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap[0]], [accounts[3]], true]
        );
        datas[1] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap[1]], [accounts[3]], false]
        );
        datas[2] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap[2]], [accounts[3]], true]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        tx = await zerion.methods
            .safeBatchTransferFrom(
                accounts[3],
                wrapper.options.address,
                [zerionTokenId[0], zerionTokenId[1], zerionTokenId[2]],
                amountToWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var zerionItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var zerionKey = (await getKeyFromEvent(tx)).key;

        await Promise.all(
            zerionTokenId.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    accounts[3],
                    wrapper.options.address,
                    amountToWrap[index],
                    zerion,
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]), 0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]), 0),
            zerionItemIds[0],
            wrapper
        );

        // #W_ZRN_6_1.1 END

        var tokenHolderWitems = "0xdc0090f8add5db06de0897a54e753af143668668";

        var witemsAddress = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var witemsTokenId = [
            "59235913901228479966524532065039050199938202913",
            "1289362882117297027568762586800442453256819880499",
        ];

        var witems = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            witemsAddress
        );

        var witemAmount = [
            (
                await witems.methods
                    .balanceOf(tokenHolderWitems, witemsTokenId[0])
                    .call()
            ).div(2),
            (
                await witems.methods
                    .balanceOf(tokenHolderWitems, witemsTokenId[1])
                    .call()
            ).div(2),
        ];

        await approveHost(tokenHolderWitems);

        await Promise.all(
            witemsTokenId.map(async (id, index) => {
                await witems.methods
                    .safeTransferFrom(
                        tokenHolderWitems,
                        accounts[3],
                        id,
                        witemAmount[index],
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderWitems,
                        })
                    );
            })
        );

        var tokenHolderZapper = "0xdcd299415efc9717564c6f23ccce25b5dbfec335";

        var zapperAddress = "0xF1F3ca6268f330fDa08418db12171c3173eE39C9";

        var zapperTokenId = ["10", "12"];

        var zapper = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zapperAddress
        );

        await approveHost(tokenHolderZapper);

        await Promise.all(
            zapperTokenId.map(async (id, index) => {
                await zapper.methods
                    .safeTransferFrom(
                        tokenHolderZapper,
                        accounts[3],
                        id,
                        3,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderZapper,
                        })
                    );
            })
        );

        // #W_ZAP_iERC20_6_1.2 START

        await zapper.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await witems.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var tokenids = [
            zapperTokenId[0],
            zapperTokenId[1],
            witemsTokenId[0],
            witemsTokenId[1],
        ];
        var tokenInstance = [zapper, zapper, witems, witems];
        var amountToWrap = [3, 3, witemAmount[0], witemAmount[1]];
        var createItem = await wrapperResource.generateCreateItem(
            tokenids,
            [accounts[3], accounts[3], accounts[3], accounts[3]],
            [zapperAddress, zapperAddress, witemsAddress, witemsAddress],
            amountToWrap
        );

        var lock = [false, true, true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
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

        var keys = (await getKeyFromEvent(tx)).key;

        await Promise.all(
            tokenids.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    accounts[3],
                    wrapper.options.address,
                    amountToWrap[index],
                    tokenInstance[index],
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToWrap[2].add(amountToWrap[3]),
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[2].add(amountToWrap[3]),
            itemIds[2],
            wrapper
        );

        // #W_ZAP_iERC20_6_1.2 END

        // #UWB_DZRN_DZAP_DiERC20_6_1.3 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zerionAddress, zerionTokenId[0], accounts[2], [zerionKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[1],
                accounts[2],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zerionAddress, zerionTokenId[2], accounts[2], [zerionKey[1]], "0x"]
        );
        datas[3] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[2],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[4] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[1], accounts[2], [keys[0]], "0x"]
        );
        datas[5] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [witemsAddress, witemsTokenId[0], accounts[2], [keys[1]], "0x"]
        );
        datas[6] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [witemsAddress, witemsTokenId[1], accounts[2], [keys[2]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "2000000000000000000",
            "2000000000000000000",
            "2000000000000000000",
            "1000000000000000000",
            "1000000000000000000",
            witemAmount[0].div(2),
            witemAmount[1].div(2),
        ];

        var tokenIdToCheck = [
            zerionTokenId[0],
            zerionTokenId[1],
            zerionTokenId[2],
            zapperTokenId[0],
            zapperTokenId[1],
            witemsTokenId[0],
            witemsTokenId[1],
        ];

        var tokenInstanceToCheck = [
            zerion,
            zerion,
            zerion,
            zapper,
            zapper,
            witems,
            witems,
        ];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [
                    zerionItemIds[0],
                    zerionItemIds[1],
                    zerionItemIds[2],
                    itemIds[0],
                    itemIds[1],
                    itemIds[2],
                    itemIds[3],
                ],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amount = [
            "2",
            "2",
            "2",
            "1",
            "1",
            witemAmount[0].div(2),
            witemAmount[1].div(2),
        ];

        await Promise.all(
            tokenIdToCheck.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    wrapper.options.address,
                    accounts[2],
                    amount[index],
                    tokenInstanceToCheck[index],
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amount[0].add(amount[1]).add(amount[2]).mul(-1),0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amount[3].add(amount[4]).mul(-1), 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap[5].add(amountToUnWrap[6]).mul(-1),
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amount[0].add(amount[1]).add(amount[2]).mul(-1),0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amount[3].add(amount[4]).mul(-1), 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[5].add(amountToUnWrap[6]).mul(-1),
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, zerionAddress, zerionTokenId[0], [zerionKey[0]], wrapper, [amount[0]]);
        await wrapperResource.checkUnlockedAmount(tx, zerionAddress, zerionTokenId[2], [zerionKey[1]], wrapper, [amount[1]]);
        // await wrapperResource.checkUnlockedAmount(tx, zapperAddress, zapperTokenId[1], [keys[0]], wrapper, [amount[2]]);
        // await wrapperResource.checkUnlockedAmount(tx, witemsAddress, witemsTokenId[0], [keys[1]], wrapper, [amount[3]]);
        // await wrapperResource.checkUnlockedAmount(tx, witemsAddress, witemsTokenId[1], [keys[2]], wrapper, [amount[4]]);


        // #UWB_DZRN_DZAP_DiERC20_6_1.3 END

        // #W_ZRN_ZAP_iERC20_6_1.4 START

        await zerion.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await witems.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await zapper.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amountToWrap = [
            2,
            2,
            2,
            1,
            1,
            witemAmount[0].div(2),
            witemAmount[1].div(2),
        ];
        var tokenIdToCheck = [
            zerionTokenId[0],
            zerionTokenId[1],
            zerionTokenId[2],
            zapperTokenId[0],
            zapperTokenId[1],
            witemsTokenId[0],
            witemsTokenId[1],
        ];

        var tokeninstanceToCheck = [
            zerion,
            zerion,
            zerion,
            zapper,
            zapper,
            witems,
            witems,
        ];

        var createItem = await wrapperResource.generateCreateItem(
            tokenIdToCheck,
            [
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
            ],
            [
                zerionAddress,
                zerionAddress,
                zerionAddress,
                zapperAddress,
                zapperAddress,
                witemsAddress,
                witemsAddress,
            ],
            amountToWrap
        );

        var lock = [false, false, false, false, false, false, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var itemIds1 = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var keys1 = (await getKeyFromEvent(tx)).key;

        await Promise.all(
            tokenIdToCheck.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    accounts[2],
                    wrapper.options.address,
                    amountToWrap[index],
                    tokeninstanceToCheck[index],
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amount[0].add(amount[1]).add(amount[2]),0),
            itemIds1[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amount[3].add(amount[4]),0,),
            itemIds1[3],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToWrap[5].add(amountToWrap[6]),
            itemIds1[5],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amount[0].add(amount[1]).add(amount[2]),0),
            itemIds1[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amount[3].add(amount[4]),0),
            itemIds1[3],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[5].add(amountToWrap[6]),
            itemIds1[5],
            wrapper
        );

        // #W_ZRN_ZAP_iERC20_6_1.4 END

        // #UWB_DZRN_DZAP_DiERC20_6_1.5 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zerionAddress, zerionTokenId[0], accounts[1], [zerionKey[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[1],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zerionAddress, zerionTokenId[2], accounts[1], [zerionKey[1]], "0x"]
        );
        datas[3] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[4] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[1], accounts[1], [keys[0]], "0x"]
        );
        datas[5] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [witemsAddress, witemsTokenId[0], accounts[1], [keys[1]], "0x"]
        );
        datas[6] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [witemsAddress, witemsTokenId[1], accounts[1], [keys[2]], "0x"]
        );

        datas[7] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[8] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[1],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[9] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[2],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[10] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[11] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[1],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[12] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                witemsAddress,
                witemsTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[13] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                witemsAddress,
                witemsTokenId[1],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "2000000000000000000",
            "2000000000000000000",
            "2000000000000000000",
            "2000000000000000000",
            "2000000000000000000",
            witemAmount[0].div(2),
            witemAmount[1].div(2),
            "2000000000000000000",
            "2000000000000000000",
            "2000000000000000000",
            "1000000000000000000",
            "1000000000000000000",
            witemAmount[0].sub(witemAmount[0].div(2)),
            witemAmount[1].sub(witemAmount[1].div(2)),
        ];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [
                    zerionItemIds[0],
                    zerionItemIds[1],
                    zerionItemIds[2],
                    itemIds[0],
                    itemIds[1],
                    itemIds[2],
                    itemIds[3],
                    zerionItemIds[0],
                    zerionItemIds[1],
                    zerionItemIds[2],
                    itemIds[0],
                    itemIds[1],
                    itemIds[2],
                    itemIds[3],
                ],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amount = ["4", "4", "4", "3", "3", witemAmount[0], witemAmount[1]];

        var tokenInstanceToCheck = [
            zerion,
            zerion,
            zerion,
            zapper,
            zapper,
            witems,
            witems,
        ];

        var tokenIdToCheck = [
            zerionTokenId[0],
            zerionTokenId[1],
            zerionTokenId[2],
            zapperTokenId[0],
            zapperTokenId[1],
            witemsTokenId[0],
            witemsTokenId[1],
        ];

        await Promise.all(
            tokenIdToCheck.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    wrapper.options.address,
                    accounts[1],
                    amount[index],
                    tokenInstanceToCheck[index],
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amount[0].add(amount[1]).add(amount[2]).mul(-1),0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amount[3].add(amount[4]).mul(-1),0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap[5]
                .add(amountToUnWrap[6])
                .add(amountToUnWrap[12])
                .add(amountToUnWrap[13])
                .mul(-1),
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amount[0].add(amount[1]).add(amount[2]).mul(-1),0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amount[3].add(amount[4]).mul(-1),0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[5]
                .add(amountToUnWrap[6])
                .add(amountToUnWrap[12])
                .add(amountToUnWrap[13])
                .mul(-1),
            itemIds[2],
            wrapper
        );

        // #UWB_DZRN_DZAP_DiERC20_6_1.5 END

        // #W_ZRN_ZAP_iERC20_6_1.6 START

        await zerion.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await witems.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await zapper.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var tokenids = [
            zerionTokenId[0],
            zerionTokenId[1],
            zerionTokenId[2],
            zapperTokenId[0],
            zapperTokenId[1],
            witemsTokenId[0],
            witemsTokenId[1],
        ];

        var tokenInstance = [
            zerion,
            zerion,
            zerion,
            zapper,
            zapper,
            witems,
            witems,
        ];

        var witemsAmountToWrap = [
            await witems.methods
                .balanceOf(accounts[1], witemsTokenId[0])
                .call(),
            await witems.methods
                .balanceOf(accounts[1], witemsTokenId[1])
                .call(),
        ];

        var amountToWrap = [
            4,
            4,
            4,
            3,
            3,
            witemsAmountToWrap[0],
            witemsAmountToWrap[1],
        ];

        var createItem = await wrapperResource.generateCreateItem(
            tokenids,
            [
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
                accounts[3],
            ],
            [
                zerionAddress,
                zerionAddress,
                zerionAddress,
                zapperAddress,
                zapperAddress,
                witemsAddress,
                witemsAddress,
            ],
            amountToWrap
        );

        var lock = [true, false, true, false, true, false, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var keys2 = (await getKeyFromEvent(tx)).key;

        await Promise.all(
            tokenids.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    accounts[1],
                    wrapper.options.address,
                    amountToWrap[index],
                    tokenInstance[index],
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amountToWrap[3].add(amountToWrap[4]),0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToWrap[5].add(amountToWrap[6]),
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]),0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[3].add(amountToWrap[4]),0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToWrap[5].add(amountToWrap[6]),
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]).add(amountToWrap[2]),0),
            zerionItemIds[0],
            wrapper
        );

        // #W_ZRN_ZAP_iERC20_6_1.6 END
        // #UWB_DZRN_DZAP_DiERC20_6_1.7 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zerionAddress, zerionTokenId[0], accounts[3], [keys2[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[1],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zerionAddress, zerionTokenId[2], accounts[3], [keys2[1]], "0x"]
        );
        datas[3] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[4] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[1], accounts[3], [keys2[2]], "0x"]
        );
        datas[5] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                witemsAddress,
                witemsTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[6] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [witemsAddress, witemsTokenId[1], accounts[3], [keys2[3]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "4000000000000000000",
            "4000000000000000000",
            "4000000000000000000",
            "3000000000000000000",
            "3000000000000000000",
            witemsAmountToWrap[0],
            witemsAmountToWrap[1],
        ];

        var tokenIdToCheck = [
            zerionTokenId[0],
            zerionTokenId[1],
            zerionTokenId[2],
            zapperTokenId[0],
            zapperTokenId[1],
            witemsTokenId[0],
            witemsTokenId[1],
        ];

        var tokenInstanceToCheck = [
            zerion,
            zerion,
            zerion,
            zapper,
            zapper,
            witems,
            witems,
        ];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[3],
                    [
                        zerionItemIds[0],
                        zerionItemIds[1],
                        zerionItemIds[2],
                        itemIds[0],
                        itemIds[1],
                        itemIds[2],
                        itemIds[3],
                    ],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "Cannot unlock"
        );
        // #UWB_DZRN_DZAP_DiERC20_6_1.7 END

        // JumpToBlock START
        await blockchainConnection.fastForward(blockToSkip);
        // JumpToBlock END

        // #UWB_DZRN_DZAP_DiERC20_6_1.8 START
        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zerionAddress, zerionTokenId[0], accounts[3], [keys2[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[1],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[2] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zerionAddress, zerionTokenId[2], accounts[3], [keys2[1]], "0x"]
        );
        datas[3] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddress,
                zapperTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[4] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperAddress, zapperTokenId[1], accounts[3], [keys2[2]], "0x"]
        );
        datas[5] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                witemsAddress,
                witemsTokenId[0],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[6] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [witemsAddress, witemsTokenId[1], accounts[3], [keys2[3]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "4000000000000000000",
            "4000000000000000000",
            "4000000000000000000",
            "3000000000000000000",
            "3000000000000000000",
            witemsAmountToWrap[0],
            witemsAmountToWrap[1],
        ];

        var tokenIdToCheck = [
            zerionTokenId[0],
            zerionTokenId[1],
            zerionTokenId[2],
            zapperTokenId[0],
            zapperTokenId[1],
            witemsTokenId[0],
            witemsTokenId[1],
        ];

        var tokenInstanceToCheck = [
            zerion,
            zerion,
            zerion,
            zapper,
            zapper,
            witems,
            witems,
        ];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[3],
                [
                    zerionItemIds[0],
                    zerionItemIds[1],
                    zerionItemIds[2],
                    itemIds[0],
                    itemIds[1],
                    itemIds[2],
                    itemIds[3],
                ],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amount = [
            "4",
            "4",
            "4",
            "3",
            "3",
            witemsAmountToWrap[0],
            witemsAmountToWrap[1],
        ];

        await Promise.all(
            tokenIdToCheck.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    wrapper.options.address,
                    accounts[3],
                    amount[index],
                    tokenInstanceToCheck[index],
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amount[0].add(amount[1]).add(amount[2]).mul(-1),0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amount[3].add(amount[4]).mul(-1),0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap[5].add(amountToUnWrap[6]).mul(-1),
            itemIds[2],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amount[0].add(amount[1]).add(amount[2]).mul(-1),0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amount[3].add(amount[4]).mul(-1),0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[5].add(amountToUnWrap[6]).mul(-1),
            itemIds[2],
            wrapper
        );
        // #UWB_DZRN_DZAP_DiERC20_6_1.8 END
    });

    it("#7", async () => {
        /**
         * Label                       ||   Operation        || Token                    || From  || Receiver address ||amount    || Token Reference     || Lock
         * #W_FLU_ADI_7_1.1                 Wrap                FLUF,Adidas                 Acc1     Acc1                4,5         A,B                    yes,yes
         *
         * #W_FLU_ADI_7_1.2                 MF:Wrap             FLUF,Adidas                 Acc1     Acc1                4,5         A,B                    yes,yes
         * #UWB_DFLU_DADI_7_1.3             Unwrap Batch        DFLU,DADI                   Acc1     Acc1                4,5         A,B                    yes,yes
         * #W_FLU_ADI_7_1.4                 Wrap                FLUF,Adidas                 Acc1     Acc1                4,5         A+,B+                  yes,yes
         * #UWB_DFLU_DADI_7_1.5             Unwrap Batch        DFLU,DADI                   Acc1     Acc2                4,5         A+,B+                  yes,yes
         * #W_FLU_ADI_7_1.6                 Wrap                FLUF,Adidas                 Acc2     Acc1                4,5         A++,B++                yes,yes
         * #UWB_DFLU_DADI_7_1.7             MF:Unwrap Batch     DFLU,DADI                   Acc1     Acc1                4,5         A++,B++                yes,yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UWB_DFLU_DADI_7_1.8             Unwrap Batch        DFLU,DADI                   Acc1     Acc1                4,5         A++,B++                yes,yes
         * #W_FLU_ADI_7_1.9                 Wrap                FLUF,Adidas                 Acc1     Acc1                3,4         A+++,B+++              yes,yes
         */
        var tokenHolderFluf = "0x1ad60130a2528c6f73a8c6e50758532949627dfd";

        var flufAddress = "0x6faD73936527D2a82AEA5384D252462941B44042";

        var flufTokenId = ["12"];

        var fluf = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            flufAddress
        );

        await approveHost(tokenHolderFluf);

        await Promise.all(
            flufTokenId.map(async (id, index) => {
                await fluf.methods
                    .safeTransferFrom(tokenHolderFluf, accounts[1], id, 8, "0x")
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderFluf,
                        })
                    );
            })
        );

        var tokenHolderAdidas = "0x41e8bf3d9288eddacc3206f9ab21b61a1c59df31";

        var adidasAddress = "0x28472a58a490c5e09a238847f66a68a47cc76f0f";

        var adidasTokenId = ["0"];

        var adidas = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            adidasAddress
        );

        await approveHost(tokenHolderAdidas);

        await Promise.all(
            adidasTokenId.map(async (id, index) => {
                await adidas.methods
                    .safeTransferFrom(
                        tokenHolderAdidas,
                        accounts[1],
                        id,
                        10,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderAdidas,
                        })
                    );
            })
        );

        await fluf.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await adidas.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #W_FLU_ADI_7_1.1 START

        var amountToWrap = ["4", "5"];
        var createItem = await wrapperResource.generateCreateItem(
            [flufTokenId[0], adidasTokenId[0]],
            [accounts[1], accounts[1]],
            [flufAddress, adidasAddress],
            amountToWrap
        );

        var lock = [true, true];
        var tx = await wrapper.methods
            .mintItems(createItem, lock)
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

        var keys = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            fluf,
            flufTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[1],
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[1], 0),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[1], 0),
            itemIds[1],
            wrapper
        );

        // #W_FLU_ADI_7_1.1 END

        // #W_FLU_ADI_7_1.2 START
        var amountToWrap = [4, 5];
        var createItem = await wrapperResource.generateCreateItem(
            [flufTokenId[0], adidasTokenId[0]],
            [accounts[1], accounts[1]],
            [flufAddress, adidasAddress],
            amountToWrap
        );

        var lock = [true, true];

        await catchCall(
            wrapper.methods.mintItems(createItem, lock).send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            ),
            "already reserved"
        );

        // #W_FLU_ADI_7_1.2 END

        // #UWB_DFLU_DADI_7_1.3 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [flufAddress, flufTokenId[0], accounts[1], [keys[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [adidasAddress, adidasTokenId[0], accounts[1], [keys[1]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = ["4000000000000000000", "5000000000000000000"];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [itemIds[0], itemIds[1]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[0][0],
            fluf,
            flufTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[1][0],
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[0].mul(-1),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[1].mul(-1),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, flufAddress, flufTokenId[0], [keys[0]], wrapper, [amountToUnWrap[0][0]]);
        await wrapperResource.checkUnlockedAmount(tx, adidasAddress, adidasTokenId[0], [keys[1]], wrapper, [5]);

        // #UWB_DFLU_DADI_7_1.3 END

        // #W_FLU_ADI_7_1.4 START

        await fluf.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await adidas.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amountToWrap = ["4", "5"];
        var createItem = await wrapperResource.generateCreateItem(
            [flufTokenId[0], adidasTokenId[0]],
            [accounts[1], accounts[1]],
            [flufAddress, adidasAddress],
            amountToWrap
        );

        var lock = [true, true];
        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var itemIdsPlus = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var keysPlus = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            fluf,
            flufTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[1],
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[1], 0),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[1], 0),
            itemIds[1],
            wrapper
        );

        // #W_FLU_ADI_7_1.4 END

        // #UWB_DFLU_DADI_7_1.5 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [flufAddress, flufTokenId[0], accounts[2], [keysPlus[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [adidasAddress, adidasTokenId[0], accounts[2], [keysPlus[1]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = ["4000000000000000000", "5000000000000000000"];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [itemIds[0], itemIds[1]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            amountToUnWrap[0][0],
            fluf,
            flufTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            amountToUnWrap[1][0],
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[0].mul(-1),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[1].mul(-1),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, flufAddress, flufTokenId[0], [keysPlus[0]], wrapper, [amountToUnWrap[0][0]]);
        await wrapperResource.checkUnlockedAmount(tx, adidasAddress, adidasTokenId[0], [keysPlus[1]], wrapper, [5]);

        // #UWB_DFLU_DADI_7_1.5 END

        // #W_FLU_ADI_7_1.6 START

        await fluf.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await adidas.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amountToWrap = ["4", "5"];
        var createItem = await wrapperResource.generateCreateItem(
            [flufTokenId[0], adidasTokenId[0]],
            [accounts[1], accounts[1]],
            [flufAddress, adidasAddress],
            amountToWrap
        );

        var lock = [true, true];
        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var itemIdsPlusPlus = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var keysPlusPlus = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[2],
            wrapper.options.address,
            amountToWrap[0],
            fluf,
            flufTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[2],
            wrapper.options.address,
            amountToWrap[1],
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[1], 0),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[1], 0),
            itemIds[1],
            wrapper
        );

        // #W_FLU_ADI_7_1.6 END

        // #UWB_DFLU_DADI_7_1.7 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [flufAddress, flufTokenId[0], accounts[1], [keysPlusPlus[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasAddress,
                adidasTokenId[0],
                accounts[1],
                [keysPlusPlus[1]],
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = ["4000000000000000000", "5000000000000000000"];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[1],
                    [itemIds[0], itemIds[1]],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "cannot unlock"
        );

        // #UWB_DFLU_DADI_7_1.7 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UWB_DFLU_DADI_7_1.8 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [flufAddress, flufTokenId[0], accounts[1], [keysPlusPlus[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                adidasAddress,
                adidasTokenId[0],
                accounts[1],
                [keysPlusPlus[1]],
                "0x",
            ]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = ["4000000000000000000", "5000000000000000000"];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[1],
                [itemIds[0], itemIds[1]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[0][0],
            fluf,
            flufTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[1][0],
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[0].mul(-1),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap[1].mul(-1),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, flufAddress, flufTokenId[0], [keysPlusPlus[0]], wrapper, [amountToUnWrap[0][0]]);
        await wrapperResource.checkUnlockedAmount(tx, adidasAddress, adidasTokenId[0], [keysPlusPlus[1]], wrapper, [5]);


        // #UWB_DFLU_DADI_7_1.8 END

        // #W_FLU_ADI_7_1.9 START

        await fluf.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await adidas.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amountToWrap = ["3", "4"];
        var createItem = await wrapperResource.generateCreateItem(
            [flufTokenId[0], adidasTokenId[0]],
            [accounts[1], accounts[1]],
            [flufAddress, adidasAddress],
            amountToWrap
        );

        var lock = [true, true];
        var tx = await wrapper.methods
            .mintItems(createItem, lock)
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

        var keys = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            fluf,
            flufTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[1],
            adidas,
            adidasTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[1], 0),
            itemIds[1],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            itemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[1], 0),
            itemIds[1],
            wrapper
        );

        // #W_FLU_ADI_7_1.9 END
    });

    it("#8", async () => {
        /**
         * Label            ||   Operation      || Token               || From || Receiver address || amount    || Token Reference    || Lock
         * #W_OSS_8_1.1          Wrap              OpenSea Storefront     Acc3        Acc3              2            A,B                  yes,yes
         * #W_PRL_8_1.2          Wrap              PARALLEL               Acc4        Acc4              1            C                    no
         * #W_PRL_8_1.3          Wrap              PARALLEL               Acc4        Acc4              1            D                    yes
         *
         * #UW_DOSS_8_1.4        MF: Unwrap        DOSS                   Acc3        Acc3              0.51         A                    yes
         * #BRN_DOSS_8_1.5       Burn(Interop.)    DOSS                   Acc3        //                0.8          //                   //
         * #UW_DOSS_8_1.6        MF: Unwrap        DOSS                   Acc3        Acc3              0.6          A                    yes
         * #UW_DOSS_8_1.7        Unwrap            DOSS                   Acc3        Acc3              1            A                    yes
         * #W_OSS_8_1.8          Wrap              OpenSea Storefront     Acc3        Acc3              1            A+                   no
         * #UW_DOSS_8_1.9        Unwrap            DOSS                   Acc3        Acc2              0.6          A+                   no
         * #UW_DOSS_8_2.1        MF: Unwrap        DOSS                   Acc3        Acc3              0.4          B                    yes
         * #W_OSS_8_2.2          Wrap              OpenSea Storefront     Acc2        Acc3              1            A++                  no
         * #UW_DOSS_8_2.3        Unwrap            DOSS                   Acc3        Acc3              0.51         B                    yes
         * #UW_DPRL_8_2.4        MF: Unwrap        DPRL                   Acc4        Acc4              0.6          C                    no
         * #BRN_DPRL_8_2.5       Burn(Interop.)    DPRL                   Acc4        //                1.4          //                   //
         * #UW_DPRL_8_2.6        Unwrap            DPRL                   Acc4        Acc4              0.6          C                    no
         * #W_PRL_8_2.7          Wrap              PARALLEL               Acc4        Acc4              1            C+                   no
         * #UW_DPRL_8_2.8        Unwrap            DPRL                   Acc4        Acc4              0.6          D                    yes
         * #W_PRL_8_2.9          Wrap              PARALLEL               Acc4        Acc5              1            D+                   no
         * #UW_DPRL_8_3.1        Unwrap            DPRL                   Acc5        Acc4              0.6            D+                 no
         */
        var tokenHolderOpensea = "0xeea89c8843e8beb56e411bb4cac6dbc2d937ee1d";

        var openseaAddresss = "0x495f947276749ce646f68ac8c248420045cb7b5e";

        var openseaTokenId = [
            "57410037754672571264739567782498400843114500082247629786531933482096386899969",
            "18024890227566502247768699122836641523078737603476603287028741122087903559780",
        ];

        var opensea = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            openseaAddresss
        );

        await approveHost(tokenHolderOpensea);

        await Promise.all(
            openseaTokenId.map(async (id, index) => {
                await opensea.methods
                    .safeTransferFrom(
                        accounts[1],
                        tokenHolderOpensea,
                        id,
                        await opensea.methods.balanceOf(accounts[1], id).call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[1],
                        })
                    );

                await opensea.methods
                    .safeTransferFrom(
                        accounts[3],
                        tokenHolderOpensea,
                        id,
                        await opensea.methods.balanceOf(accounts[3], id).call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[3],
                        })
                    );
            })
        );

        await Promise.all(
            openseaTokenId.map(async (id, index) => {
                await opensea.methods
                    .safeTransferFrom(
                        tokenHolderOpensea,
                        accounts[3],
                        id,
                        1,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderOpensea,
                        })
                    );
            })
        );

        // #W_OSS_8_1.1 START

        await opensea.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amountToWrap = [1, 1];
        var createItem = await wrapperResource.generateCreateItem(
            [openseaTokenId[0], openseaTokenId[1]],
            [accounts[3], accounts[3]],
            [openseaAddresss, openseaAddresss],
            amountToWrap
        );

        var lock = [true, true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var openseaItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var openseaKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0],
            opensea,
            openseaTokenId[0]
        );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0],
            opensea,
            openseaTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            openseaItemIds[0],
            wrapper
        );

        // #W_OSS_8_1.1 END

        var tokenHolderParallel = "0xd0829f8dda953e85da70b0a62a2f4e9a774ebf16";

        var parallelTokenAddresss =
            "0x76be3b62873462d2142405439777e971754e8e77";

        var parallelTokenId = ["10144", "10150"];

        var parallel = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            parallelTokenAddresss
        );

        await approveHost(tokenHolderParallel);

        await Promise.all(
            parallelTokenId.map(async (id, index) => {
                await parallel.methods
                    .safeTransferFrom(
                        tokenHolderParallel,
                        accounts[4],
                        id,
                        1,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderParallel,
                        })
                    );
            })
        );

        // #W_PRL_8_1.2 START

        await parallel.methods
            .setApprovalForAll(wrapper.options.address, accounts[4])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        var amountToWrap = [1];
        var createItem = await wrapperResource.generateCreateItem(
            [parallelTokenId[0]],
            [accounts[4]],
            [parallelTokenAddresss],
            amountToWrap
        );

        var lock = [false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var parallelItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await wrapperResource.checkBalance1155(
            tx,
            accounts[4],
            wrapper.options.address,
            amountToWrap[0],
            parallel,
            parallelTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            utilities.normalizeValue(amountToWrap[0], 0),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            parallelItemIds[0],
            wrapper
        );

        // #W_PRL_8_1.2 END

        // #W_PRL_8_1.3 START


        var amountToWrap  = ["1"];

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap, [accounts[4]], true]
        );

        tx = await parallel.methods
            .safeTransferFrom(
                accounts[4],
                wrapper.options.address,
                parallelTokenId[1],
                amountToWrap[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );
        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var parallelKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[4],
            wrapper.options.address,
            amountToWrap[0],
            parallel,
            parallelTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            utilities.normalizeValue(amountToWrap[0],0),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0],0),
            parallelItemIds[0],
            wrapper
        );

        // #W_PRL_8_1.3 END

        // #UW_DOSS_8_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[0],
                accounts[3],
                [openseaKey[0]],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    openseaItemIds[0],
                    "510000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "amount"
        );

        // #UW_DOSS_8_1.4 END

        // #BRN_DOSS_8_1.5 START

        var burnValue = "800000000000000000";

        erc20Contract = await asInteroperableInterface(openseaItemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        // #BRN_DOSS_8_1.5 END

        // #UW_DOSS_8_1.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[0],
                accounts[3],
                [openseaKey[0]],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[3],
                    openseaItemIds[0],
                    "600000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "amount"
        );

        // #UW_DOSS_8_1.6 END

        // #UW_DOSS_8_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[0],
                accounts[3],
                [openseaKey[0]],
                "0x",
            ]
        );

        var amountToUnWrap = "1000000000000000000";
        var tx = await wrapper.methods
            .burn(accounts[3], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            opensea,
            openseaTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, openseaAddresss, openseaTokenId[0], [openseaKey[0]], wrapper, [amountToUnWrap[0][0]]);

        // #UW_DOSS_8_1.7 END

        // #W_OSS_8_1.8 START

        await parallel.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        var amountToWrap = [1];
        var createItem = await wrapperResource.generateCreateItem(
            [openseaTokenId[0]],
            [accounts[3]],
            [openseaAddresss],
            amountToWrap
        );

        var lock = [false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[3],
            wrapper.options.address,
            amountToWrap[0],
            opensea,
            openseaTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "800000000000000000",
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "800000000000000000",
            openseaItemIds[0],
            wrapper
        );

        // #W_OSS_8_1.8 END

        // #UW_DOSS_8_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[0],
                accounts[2],
                [openseaKey[0]],
                "0x",
            ]
        );

        var amountToUnWrap = "600000000000000000";
        var tx = await wrapper.methods
            .burn(accounts[3], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            "1",
            opensea,
            openseaTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        // #UW_DOSS_8_1.9 END

        // #UW_DOSS_8_2.1 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[3],
                [openseaKey[1]],
                "0x",
            ]
        );

        var amountToUnWrap = "400000000000000000";
        await catchCall(
            wrapper.methods
                .burn(accounts[3], openseaItemIds[0], amountToUnWrap, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[3],
                    })
                ),
            "amount"
        );

        // #UW_DOSS_8_2.1 END

        // #W_OSS_8_2.2 START

        await opensea.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        var amountToWrap = ["1"];
        var createItem = await wrapperResource.generateCreateItem(
            [openseaTokenId[0]],
            [accounts[3]],
            [openseaAddresss],
            amountToWrap
        );

        var lock = [false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[2] })
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[2],
            wrapper.options.address,
            amountToWrap[0],
            opensea,
            openseaTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            "600000000000000000",
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "600000000000000000",
            openseaItemIds[0],
            wrapper
        );

        // #W_OSS_8_2.2 END

        // #UW_DOSS_8_2.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                openseaAddresss,
                openseaTokenId[1],
                accounts[3],
                [openseaKey[1]],
                "0x",
            ]
        );

        var amountToUnWrap = "510000000000000000";
        var tx = await wrapper.methods
            .burn(accounts[3], openseaItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[3],
            "1",
            opensea,
            openseaTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            openseaItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, openseaAddresss, openseaTokenId[1], [openseaKey[1]], wrapper, [1]);

        // #UW_DOSS_8_2.3 END

        // #UW_DPRL_8_2.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[0],
                accounts[4],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[4],
                    parallelItemIds[0],
                    "600000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[4],
                    })
                ),
            "amount"
        );

        // #UW_DPRL_8_2.4 END

        // #BRN_DPRL_8_2.5 START

        var burnValue = "1400000000000000000";

        erc20Contract = await asInteroperableInterface(parallelItemIds[0]);
        var tx = await erc20Contract.methods
            .burn(burnValue)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkSupply(
            tx,
            burnValue.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        // #BRN_DPRL_8_2.5 END

        // #UW_DPRL_8_2.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[0],
                accounts[4],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var amountToUnWrap = "600000000000000000";
        var tx = await wrapper.methods
            .burn(accounts[4], parallelItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[4],
            "1",
            parallel,
            parallelTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            amountToUnWrap.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        // #UW_DPRL_8_2.6 END

        //#W_PRL_8_2.7 START

        await parallel.methods
            .setApprovalForAll(wrapper.options.address, accounts[4])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        var amountToWrap = [1];
        var createItem = await wrapperResource.generateCreateItem(
            [parallelTokenId[0]],
            [accounts[4]],
            [parallelTokenAddresss],
            amountToWrap
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[4],
            wrapper.options.address,
            amountToWrap[0],
            parallel,
            parallelTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            utilities.normalizeValue(amountToWrap[0], 0),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            parallelItemIds[0],
            wrapper
        );

        //#W_PRL_8_2.7 END

        // #UW_DPRL_8_2.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[1],
                accounts[4],
                parallelKey,
                "0x",
            ]
        );

        var amountToUnWrap = "600000000000000000";
        var tx = await wrapper.methods
            .burn(accounts[4], parallelItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[4],
            "1",
            parallel,
            parallelTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            amountToUnWrap.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, parallelTokenAddresss, parallelTokenId[1], parallelKey, wrapper, [1]);

        await parallel.methods
            .setApprovalForAll(wrapper.options.address, accounts[5])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[5],
                })
            );

        // #UW_DPRL_8_2.8 END

        // #W_PRL_8_2.9 START

        var amountToWrap = [1];

        var createItem = await wrapperResource.generateCreateItem(
            [parallelTokenId[1]],
            [accounts[5]],
            [parallelTokenAddresss],
            amountToWrap
        );

        var lock = [false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[4] })
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[4],
            wrapper.options.address,
            amountToWrap[0],
            parallel,
            parallelTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[5],
            "600000000000000000",
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "600000000000000000",
            parallelItemIds[0],
            wrapper
        );

        // #W_PRL_8_2.9 END

        // #UW_DPRL_8_3.1 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                parallelTokenAddresss,
                parallelTokenId[1],
                accounts[4],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var amountToUnWrap = "600000000000000000";
        var tx = await wrapper.methods
            .burn(accounts[5], parallelItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[5],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[4],
            "1",
            parallel,
            parallelTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[5],
            amountToUnWrap.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            parallelItemIds[0],
            wrapper
        );

        // #UW_DPRL_8_3.1 END
    });

    it("#9", async () => {
        /**
         * Label            ||   Operation      || Token               || From || Receiver address || amount    || Token Reference    || Lock
         * #W_PLN_9_1.1          Wrap              Planets                Acc1        Acc1              4            A                    yes
         *
         * #TRA_DPLN_9_1.2       Transfer          DPLN                   Acc1        Acc2              1.51         //                   //
         * #UW_DPLN_9_1.3        MF: Unwrap        DPLN                   Acc1        Acc1              2.5          A                    yes
         * #UW_DPLN_9_1.4        Unwrap            DPLN                   Acc1        Acc1              2            A                    yes
         * #W_PLN_9_1.5          Wrap              Planets                Acc1        Acc1              2            A+                   yes
         * #TRA_DPLN_9_1.6       Transfer          DPLN                   Acc1        Acc2              0.5          //                   //
         * #UW_DPLN_9_1.7        MF: Unwrap        DPLN                   Acc2        Acc2              2            A+                   yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DPLN_9_1.8        Unwrap            DPLN                   Acc2        Acc2              2            A+                   yes
         * #UW_DPLN_9_1.9        Unwrap            DPLN                   Acc1        Acc2              2            A                    yes
         */

        var tokenHolderPlanets = "0xb2a7bda18179d453ab6288a52dc51504d0978b9f";

        var planetsAddress = "0x7deb7bce4d360ebe68278dee6054b882aa62d19c";

        var planetsTokenId = ["5"];

        var planets = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            planetsAddress
        );

        await approveHost(tokenHolderPlanets);

        await Promise.all(
            planetsTokenId.map(async (id, index) => {
                await planets.methods
                    .safeTransferFrom(
                        tokenHolderPlanets,
                        accounts[1],
                        id,
                        await planets.methods
                            .balanceOf(tokenHolderPlanets, id)
                            .call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderPlanets,
                        })
                    );
            })
        );

        // #W_PLN_9_1.1 START

        var amountToWrap = ["4"];

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap, [accounts[1]], true]
        );

        tx = await planets.methods
            .safeTransferFrom(
                accounts[1],
                wrapper.options.address,
                planetsTokenId[0],
                amountToWrap[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );
        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var planetsItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var planetsKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            planets,
            planetsTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            planetsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            planetsItemIds[0],
            wrapper
        );

        // #W_PLN_9_1.1 END

        // #TRA_DPLN_9_1.2 START

        await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                planetsItemIds[0],
                "1500000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #TRA_DPLN_9_1.2 END

        // #UW_DPLN_9_1.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [planetsAddress, planetsTokenId[0], accounts[1], planetsKey, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[1],
                    planetsItemIds[0],
                    "2500000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );

        // #UW_DPLN_9_1.3 END

        // #UW_DPLN_9_1.4 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [planetsAddress, planetsTokenId[0], accounts[1], planetsKey, "0x"]
        );

        var amountToUnWrap = "2000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], planetsItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            "2",
            planets,
            planetsTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap.mul(-1),
            planetsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            planetsItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, planetsAddress, planetsTokenId[0], planetsKey, wrapper, [amountToUnWrap[0]]);

        await planets.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #UW_DPLN_9_1.4 END

        // #W_PLN_9_1.5 START

        var amountToWrap = ["2"];

        var createItem = await wrapperResource.generateCreateItem(
            [planetsTokenId[0]],
            [accounts[1]],
            [planetsAddress],
            amountToWrap
        );

        var lock = [true];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var planetsKey2 = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            planets,
            planetsTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            planetsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            planetsItemIds[0],
            wrapper
        );

        // #W_PLN_9_1.5 END

        // #TRA_DPLN_9_1.6 START

        await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                planetsItemIds[0],
                "500000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #TRA_DPLN_9_1.6 END

        // #UW_DPLN_9_1.7 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [planetsAddress, planetsTokenId[0], accounts[2], planetsKey2, "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(
                    accounts[2],
                    planetsItemIds[0],
                    "2000000000000000000",
                    data
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "cannot unlock"
        );

        // #UW_DPLN_9_1.7 END

        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DPLN_9_1.8 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [planetsAddress, planetsTokenId[0], accounts[2], planetsKey2, "0x"]
        );

        var amountToUnWrap = "2000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[2], planetsItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            "2",
            planets,
            planetsTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToUnWrap.mul(-1),
            planetsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            planetsItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, planetsAddress, planetsTokenId[0], planetsKey2, wrapper, [amountToUnWrap[0]]);

        // #UW_DPLN_9_1.8 END

        // #UW_DPLN_9_1.9 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [planetsAddress, planetsTokenId[0], accounts[2], planetsKey, "0x"]
        );

        var amountToUnWrap = "2000000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], planetsItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            "2",
            planets,
            planetsTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap.mul(-1),
            planetsItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            planetsItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, planetsAddress, planetsTokenId[0], planetsKey, wrapper, [amountToUnWrap[0]]);

        // #UW_DPLN_9_1.9 END
    });

    it("#10", async () => {
        /**
         * Label            ||   Operation      || Token               || From || Receiver address   || amount    || Token Reference    || Lock
         * #W_ZRN_10_1.1         Wrap              Zerion                 Acc1        Acc1                1            A                    no
         *
         * #TRA_DZRN_10_1.2      Transfer          DZRN                   Acc1        Acc2                0.4          //                   //
         * #UW_DZRN_10_1.3       Unwrap            DZRN                   Acc1        Acc1                0.6          A                    no
         * #W_ZRN_10_1.4         Wrap              Zerion                 Acc3       Acc2,Acc2,Acc4,Acc4  1,1,1,1      B,C,D,E              no,no,no,no
         * #W_ZRN_10_1.5         Wrap              Zerion                 Acc1        Acc1                1            F                    no
         * #UW_DZRN_10_1.6       MF:Unwrap         DZRN                   Acc1        Acc1                0.6          F                    no
         * #UW_DZRN_10_1.7       Unwrap            DZRN                   Acc2        Acc3                1,1          D,F                  no,no
         * #UW_DZRN_10_1.8       Unwrap            DZRN                   Acc4        Acc3                1,1          C,E                  no,no
         * #W_ZRN_10_1.9         Wrap              Zerion                 Acc3        Acc3                1,1,1        F+,C+,E+             no,no,no
         */

        var tokenHolderZerion = "0xecde04e088828c93a1003b9388727a25c064e5e3";

        var zerionAddress = "0x74EE68a33f6c9f113e22B3B77418B75f85d07D22";

        var zerionTokenId = ["10", "2", "3", "4", "5", "7"];

        var zerion = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zerionAddress
        );

        await approveHost(tokenHolderZerion);

        await Promise.all(
            zerionTokenId.map(async (id, index) => {
                await zerion.methods
                    .safeTransferFrom(
                        accounts[3],
                        tokenHolderZerion,
                        id,
                        await zerion.methods.balanceOf(accounts[3], id).call(),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: accounts[3],
                        })
                    );
            })
        );

        await Promise.all(
            zerionTokenId.slice(2).map(async (id, index) => {
                await zerion.methods
                    .safeTransferFrom(
                        tokenHolderZerion,
                        accounts[3],
                        id,
                        1,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderZerion,
                        })
                    );
            })
        );

        await Promise.all(
            zerionTokenId.slice(0, 2).map(async (id, index) => {
                await zerion.methods
                    .safeTransferFrom(
                        tokenHolderZerion,
                        accounts[1],
                        id,
                        1,
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderZerion,
                        })
                    );
            })
        );

        // #W_ZRN_10_1.1 START

        var amountToWrap = ["1"];

        var data = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [amountToWrap, [accounts[1]], false]
        );

        tx = await zerion.methods
            .safeTransferFrom(
                accounts[1],
                wrapper.options.address,
                zerionTokenId[0],
                amountToWrap[0],
                data
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );
        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var zerionItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        await catchCall(blockchainCall(mainInterface.methods.safeTransferFrom, accounts[1], wrapper.options.address, zerionItemIds[0], utilities.numberToString(1e18), "0x", {from : accounts[1]}), "invalid");

        await catchCall(blockchainCall(wrapper.methods.safeTransferFrom, accounts[1], wrapper.options.address, zerionItemIds[0], utilities.numberToString(1e18), "0x", {from : accounts[1]}), "invalid");

        var zerionKey = (await getKeyFromEvent(tx)).key;

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            zerion,
            zerionTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            zerionItemIds[0],
            wrapper
        );

        // #W_ZRN_10_1.1 END

        // #TRA_DZRN_10_1.2 START

        await wrapper.methods
            .safeTransferFrom(
                accounts[1],
                accounts[2],
                zerionItemIds[0],
                "400000000000000000",
                "0x"
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #TRA_DZRN_10_1.2 END

        // #UW_DZRN_10_1.3 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zerionAddress, zerionTokenId[0], accounts[1], zerionKey, "0x"]
        );

        var amountToUnWrap = "600000000000000000";

        var tx = await wrapper.methods
            .burn(accounts[1], zerionItemIds[0], amountToUnWrap, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            "1",
            zerion,
            zerionTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToUnWrap.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, zerionAddress, zerionTokenId[0], zerionKey, wrapper, [1]);

        // #UW_DZRN_10_1.3 END

        // #W_ZRN_10_1.4 START

        var amountToWrap = [1, 1, 1, 1];

        var datas = [];

        datas[0] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap[0]], [accounts[2]], false]
        );
        datas[1] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap[1]], [accounts[2]], false]
        );
        datas[2] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap[2]], [accounts[4]], false]
        );
        datas[3] = abi.encode(
            ["uint256[]", "address[]", "bool"],
            [[amountToWrap[3]], [accounts[4]], false]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        tx = await zerion.methods
            .safeBatchTransferFrom(
                accounts[3],
                wrapper.options.address,
                [
                    zerionTokenId[2],
                    zerionTokenId[3],
                    zerionTokenId[4],
                    zerionTokenId[5],
                ],
                amountToWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        await Promise.all(
            zerionTokenId.slice(2).map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    accounts[3],
                    wrapper.options.address,
                    amountToWrap[index],
                    zerion,
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            "1600000000000000000",
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[4],
            "2000000000000000000",
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            "3600000000000000000",
            zerionItemIds[0],
            wrapper
        );

        // #W_ZRN_10_1.4 END

        // #W_ZRN_10_1.5 START

        await zerion.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var amountToWrap = ["1"];

        var createItem = await wrapperResource.generateCreateItem(
            [zerionTokenId[1]],
            [accounts[1]],
            [zerionAddress],
            amountToWrap
        );

        var lock = [false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[1] })
            );

        await wrapperResource.checkBalance1155(
            tx,
            accounts[1],
            wrapper.options.address,
            amountToWrap[0],
            zerion,
            zerionTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            utilities.normalizeValue(amountToWrap[0], 0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities.normalizeValue(amountToWrap[0], 0),
            zerionItemIds[0],
            wrapper
        );

        // #W_ZRN_10_1.5 END

        // #UW_DZRN_10_1.6 START

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[1],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], zerionItemIds[0], "600000000000000000", data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );

        // #UW_DZRN_10_1.6 END

        // #UW_DZRN_10_1.7 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[4],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[1],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "1000000000000000000",
            "1000000000000000000",
        ];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[2],
                [zerionItemIds[0], zerionItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );
        // #UW_DZRN_10_1.7 END

        // #UW_DZRN_10_1.8 START

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[3],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zerionAddress,
                zerionTokenId[5],
                accounts[3],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [
            "1000000000000000000",
            "1000000000000000000",
        ];

        var tx1 = await wrapper.methods
            .burnBatch(
                accounts[4],
                [zerionItemIds[0], zerionItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[4],
                })
            );

        var tokenIdToCheck = [
            zerionTokenId[4],
            zerionTokenId[1],
            // zerionTokenId[3],
            // zerionTokenId[5],
        ];

        var accountsTocheck = [accounts[3], accounts[3]];

        await Promise.all(
            tokenIdToCheck.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    wrapper.options.address,
                    accountsTocheck[index],
                    1,
                    zerion,
                    id
                );
            })
        );

        var tokenIdToCheck = [
            zerionTokenId[3],
            zerionTokenId[5],
        ];

        var accountsTocheck = [accounts[3], accounts[3]];

        await Promise.all(
            tokenIdToCheck.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    wrapper.options.address,
                    accountsTocheck[index],
                    1,
                    zerion,
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToUnWrap[0]
                .add(amountToUnWrap[1])
                .mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            tx1,
            accounts[4],
            amountToUnWrap[0]
                .add(amountToUnWrap[1])
                .mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            (amountToUnWrap[0]
                .add(amountToUnWrap[1])).mul(2)
                .mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await zerion.methods
            .setApprovalForAll(wrapper.options.address, accounts[3])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[3],
                })
            );

        // #UW_DZRN_10_1.8 END

        // #W_ZRN_10_1.9 START

        var amountToWrap = [1, 1, 1];

        var createItem = await wrapperResource.generateCreateItem(
            [zerionTokenId[1], zerionTokenId[3], zerionTokenId[5]],
            [accounts[3], accounts[3], accounts[3]],
            [zerionAddress, zerionAddress, zerionAddress],
            amountToWrap
        );

        var lock = [false, false, false];

        var tx = await wrapper.methods
            .mintItems(createItem, lock)
            .send(
                blockchainConnection.getSendingOptions({ from: accounts[3] })
            );

        var tokenIdToCheck = [
            zerionTokenId[1],
            zerionTokenId[3],
            zerionTokenId[5],
        ];

        await Promise.all(
            tokenIdToCheck.map(async (id, index) => {
                await wrapperResource.checkBalance1155(
                    tx,
                    accounts[3],
                    wrapper.options.address,
                    amountToWrap[index],
                    zerion,
                    id
                );
            })
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[3],
            utilities
                .normalizeValue(amountToWrap[0], 0)
                .add(utilities.normalizeValue(amountToWrap[1], 0))
                .add(utilities.normalizeValue(amountToWrap[2], 0)),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            utilities
                .normalizeValue(amountToWrap[0], 0)
                .add(utilities.normalizeValue(amountToWrap[1], 0))
                .add(utilities.normalizeValue(amountToWrap[2], 0)),
            zerionItemIds[0],
            wrapper
        );

        // #W_ZRN_10_1.9 END
    });

    it("#11", async () => {
        /**
         * Label            ||   Operation        || Token         || From  || Receiver address ||amount    || Token Reference                  || Lock
         * #W_PLN_11_1.1         Wrap                Planets          Acc1     Acc2               3,2          A,B                                 yes,yes
         *
         * #UL_DPLN_11_1.2       MF: Unlock          DPLN             Acc2     //                 3            A                                   yes
         * #UL_DPLN_11_1.3       MF: Unlock          DPLN             Acc1     //                 3            A + address(0) and id empty         yes
         * #UL_DPLN_11_1.4       Unlock              DPLN             Acc1     //                 3            A                                   yes
         * #UW_DPLN_11_1.5       Unwrap              DPLN             Acc2     Acc2               3            A                                   no
         * #W_POS_ZAP_11_1.6     Wrap                Party OS,Zapper  Acc1     Acc2,Acc2          x,4          C,D                                 yes,yes
         * #W_ZAP_11_1.7         Wrap                Zapper           Acc2     Acc2,Acc1          1,1          E,F                                 yes,no
         * #UL_DZAP_11_1.8       MF: Unlock          DZAP             Acc2     //                 1            F                                   no
         * #UW_DZAP_11_1.9       Unwrap              DZAP             Acc1     Acc1               1            F                                   no
         * #UL_DPOS_11_2.1       MF: Unlock          DPOS             Acc2     //                 x            C                                   yes
         * #UL_DPOS_DZAP_11_2.2  MF: Unlock          DPOS,DZAP        Acc1     //                 0,4          C,D                                 yes
         * #UL_DPOS_DZAP_11_2.3  MF: Unlock          DPOS,DZAP        Acc1     //                 x,4          C,D*                                yes  *owner as address (0) for D
         * #UL_DPOS_DZAP_11_2.4  MF: Unlock          DPOS,DZAP        Acc1     //                 x,4          C,D*                                yes  *wrong owner for D
         * #UL_DPOS_DZAP_11_2.5  MF: Unlock          DPOS,DZAP        Acc1     //                 x/2,2        C,D                                 yes
         * #UL_DPOS_DZAP_11_2.6  MF: Unlock          DPOS,DZAP        Acc1     //                 x*2,6        C,D                                 yes
         * #UW_DPOS_DZAP_11_2.7  MF: Unwrap          DPOS,DZAP        Acc2     Acc1               x/2,2        C,D                                 yes,yes
         * #UL_DPOS_11_2.8       MF: Unlock          DPOS             Acc1     //                 x            C*                                  yes  *1) pass tokenaddress and token id don't exist, 2) token address COS and id not wrapped, 3) token address COS and id B
         * #UW_DPOS_DZAP_11_2.9  MF: Unwrap          DPOS             Acc2     Acc1               x            C                                   yes
         * #UL_DPOS_11_3.1       Unlock              DPOS             Acc1     //                 x            C                                   yes
         * #UL_DZAP_11_3.2       MF: Unlock          DZAP             Acc1     //                 1            E                                   yes
         * #UL_DZAP_11_3.3       MF: Unlock          DZAP             Acc2     //                 0            E                                   yes
         * #UW_DZAP_11_3.4       MF: Unwrap          DZAP             Acc1     Acc1               1            E                                   yes
         * #UW_DPOS_DZAP_11_3.5  Unwrap              DPOS,DZAP        Acc2     Acc1               x,1          C,E                                 no,yes
         * #UW_DZAP_11_3.6       MF:Unwrap           DZAP             Acc2     Acc1               1            D                                   yes
         * JumpToBlock -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
         * #UW_DZAP_11_3.7       Unwrap              DZAP             Acc2     Acc1               1            D                                   yes
         */
        var tokenHolderPlanets = "0xb2a7bda18179d453ab6288a52dc51504d0978b9f";

        var zapperAddressPlanets = "0x7dEB7Bce4d360Ebe68278dee6054b882aa62D19c";

        var tokenIdPlanets = ["6", "7"];

        var planetsAmount = [3, 2];

        var planets = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zapperAddressPlanets
        );

        await approveHost(tokenHolderPlanets);

        await Promise.all(
            tokenIdPlanets.map(async (id, index) => {
                await planets.methods
                    .safeTransferFrom(
                        tokenHolderPlanets,
                        accounts[1],
                        id,
                        planetsAmount[index],
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderPlanets,
                        })
                    );
            })
        );

        await planets.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        // #W_PLN_11_1.1 START

        var amountToWrap = ["3", "2"];

        var createItem = await wrapperResource.generateCreateItem(
            [tokenIdPlanets[0], tokenIdPlanets[1]],
            [accounts[2], accounts[2]],
            [zapperAddressPlanets, zapperAddressPlanets],
            amountToWrap
        );

        var lock = [true, true];
        var txAE = await wrapper.methods.mintItems(createItem, lock).send(
            blockchainConnection.getSendingOptions({
                from: accounts[1],
            })
        );

        var logs = (await web3.eth.getTransactionReceipt(txAE.transactionHash))
            .logs;

        var itemIdsAE = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var key = (await getKeyFromEvent(txAE)).key;

        tokenIdPlanets.map(async (id, index) => {
            await wrapperResource.checkBalance1155(
                txAE,
                accounts[1],
                wrapper.options.address,
                amountToWrap[index],
                planets,
                id
            );
        });

        await wrapperResource.checkBalanceItem(
            txAE,
            accounts[2],
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            itemIdsAE[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            txAE,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            itemIdsAE[0],
            wrapper
        );

        // #W_PLN_11_1.1 END

        // #UL_DPLN_11_1.2 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [(await getIdAndAddressFromEvents(txAE))["from"][0]],
                    [(await getIdAndAddressFromEvents(txAE))["address"][0]],
                    [(await getIdAndAddressFromEvents(txAE))["id"][0]],
                    [(await getIdAndAddressFromEvents(txAE))["amount"][0]]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Cannot unlock"
        );

        // #UL_DPLN_11_1.2 END

        // #UL_DPLN_11_1.3 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [
                        (await getIdAndAddressFromEvents(txAE))["from"][0],
                        (await getIdAndAddressFromEvents(txAE))["from"][0],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txAE))["address"][0],
                        utilities.voidEthereumAddress,
                    ],
                    [(await getIdAndAddressFromEvents(txAE))["id"][0], "0"],
                    [
                        (await getIdAndAddressFromEvents(txAE))["amount"][0],
                        (await getIdAndAddressFromEvents(txAE))["amount"][0],
                    ]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "reserve"
        );

        // #UL_DPLN_11_1.3 END

        // #UL_DPLN_11_1.4 START

        var unlockTx = await wrapper.methods
            .unlockReserves(
                [(await getIdAndAddressFromEvents(txAE))["from"][0]],
                [(await getIdAndAddressFromEvents(txAE))["address"][0]],
                [(await getIdAndAddressFromEvents(txAE))["id"][0]],
                [(await getIdAndAddressFromEvents(txAE))["amount"][0]]
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );


        assert.equal((await wrapper.methods.reserveData(key[0]).call()).amount, "0");
        await wrapperResource.checkUnlockedAmount(unlockTx, (await getIdAndAddressFromEvents(txAE))["address"][0], (await getIdAndAddressFromEvents(txAE))["id"][0], [key[0]], wrapper, [0]);

        // #UL_DPLN_11_1.4 END

        // #UW_DPLN_11_1.5 START

        var amountToBurn = "3000000000000000000";

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperAddressPlanets,
                tokenIdPlanets[0],
                accounts[2],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[2], itemIdsAE[0], amountToBurn, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[2],
            amountToBurn[0],
            planets,
            tokenIdPlanets[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToBurn.mul(-1),
            itemIdsAE[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToBurn.mul(-1),
            itemIdsAE[0],
            wrapper
        );

        // #UW_DPLN_11_1.5 END

        var tokenHolderOs = "0x43126fb5e1fe86bb44b084d09f651358b97ebf0c";

        var osTokenAddresss = "0x8d53aFBEB62C18917B5F71385d52E8ba87669794";

        var osTokenId = ["229469500060684890387016958043438257757654171090"];

        var os = new web3.eth.Contract(knowledgeBase.IERC1155ABI, osTokenAddresss);

        await approveHost(tokenHolderOs);

        await Promise.all(
            osTokenId.map(async (id, index) => {
                await os.methods
                    .safeTransferFrom(
                        tokenHolderOs,
                        accounts[1],
                        id,
                        (
                            await os.methods.balanceOf(tokenHolderOs, id).call()
                        ).div(2),
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderOs,
                        })
                    );
            })
        );

        await os.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        var balanceOs = await os.methods
            .balanceOf(accounts[1], osTokenId[0])
            .call();

        var tokenHolderZapper = "0xdcd299415efc9717564c6f23ccce25b5dbfec335";

        var zapperTokenAddresss = "0xF1F3ca6268f330fDa08418db12171c3173eE39C9";

        var zapperTokenId = ["9", "5", "8"];

        var zapperAmount = [4, 2, 4];

        var zapperReceivers = [accounts[2], accounts[2], accounts[1]];

        var zapper = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            zapperTokenAddresss
        );

        await approveHost(tokenHolderZapper);

        await Promise.all(
            zapperTokenId.map(async (id, index) => {
                await zapper.methods
                    .safeTransferFrom(
                        tokenHolderZapper,
                        zapperReceivers[index],
                        id,
                        zapperAmount[index],
                        "0x"
                    )
                    .send(
                        blockchainConnection.getSendingOptions({
                            from: tokenHolderZapper,
                        })
                    );
            })
        );

        await zapper.methods
            .setApprovalForAll(wrapper.options.address, accounts[1])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await zapper.methods
            .setApprovalForAll(wrapper.options.address, accounts[2])
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        // #W_POS_ZAP_11_1.6 START

        var amountToWrapBD = [balanceOs, "4"];
        var tokenIdToWrap = [osTokenId[0], zapperTokenId[2]];
        var receivers = [accounts[2], accounts[2]];
        var tokenAddressToWrap = [osTokenAddresss, zapperTokenAddresss];
        var tokenInstance = [os, zapper];

        var createItem = await wrapperResource.generateCreateItem(
            tokenIdToWrap,
            receivers,
            tokenAddressToWrap,
            amountToWrapBD
        );

        var lock = [true, true];

        var txBD = await wrapper.methods.mintItems(createItem, lock).send(
            blockchainConnection.getSendingOptions({
                from: accounts[1],
            })
        );

        var logs = (await web3.eth.getTransactionReceipt(txBD.transactionHash))
            .logs;

        var itemIdsBD = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var key = (await getKeyFromEvent(txBD)).key;

        tokenIdToWrap.map(async (id, index) => {
            await wrapperResource.checkBalance1155(
                txBD,
                accounts[1],
                wrapper.options.address,
                amountToWrapBD[index],
                tokenInstance[index],
                id
            );
        });

        await wrapperResource.checkBalanceItem(
            txBD,
            accounts[2],
            amountToWrapBD[0],
            itemIdsBD[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            txBD,
            accounts[2],
            utilities.normalizeValue(amountToWrapBD[1], 0),
            itemIdsBD[1],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            txBD,
            accounts[2],
            amountToWrapBD[0],
            itemIdsBD[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            txBD,
            amountToWrapBD[0],
            itemIdsBD[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            txBD,
            utilities.normalizeValue(amountToWrapBD[1], 0),
            itemIdsBD[1],
            wrapper
        );

        // #W_POS_ZAP_11_1.6 END

        // #W_ZAP_11_1.7 START

        var amountToWrap = ["1", "1"];
        var zerionTokenIdToWrap = [zapperTokenId[0], zapperTokenId[1]];

        var createItem = await wrapperResource.generateCreateItem(
            zerionTokenIdToWrap,
            [accounts[2], accounts[1]],
            [zapperTokenAddresss, zapperTokenAddresss],
            amountToWrap
        );

        var lock = [true, false];

        var txCF = await wrapper.methods.mintItems(createItem, lock).send(
            blockchainConnection.getSendingOptions({
                from: accounts[2],
            })
        );

        var logs = (await web3.eth.getTransactionReceipt(txCF.transactionHash))
            .logs;

        var zerionItemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        var keyCF = (await getKeyFromEvent(txCF)).key;

        zerionTokenIdToWrap.map(async (id, index) => {
            await wrapperResource.checkBalance1155(
                txCF,
                accounts[2],
                wrapper.options.address,
                amountToWrap[index],
                zapper,
                id
            );
        });

        await wrapperResource.checkBalanceItem(
            txCF,
            accounts[2],
            utilities.normalizeValue(amountToWrap[0], 0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkBalanceItem(
            txCF,
            accounts[1],
            utilities.normalizeValue(amountToWrap[1], 0),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            txCF,
            utilities.normalizeValue(amountToWrap[0].add(amountToWrap[1]), 0),
            zerionItemIds[0],
            wrapper
        );

        // #W_ZAP_11_1.7 END

        // #UL_DZAP_11_1.8 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [accounts[2]],
                    [zapperTokenAddresss],
                    [zapperTokenId[1]],
                    [amountToWrap[1]]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "reserve"
        );

        // #UL_DZAP_11_1.8 END

        // #UW_DZAP_11_1.9 START

        var amountToBurn = "1000000000000000000";

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                zapperTokenAddresss,
                zapperTokenId[1],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        var tx = await wrapper.methods
            .burn(accounts[1], zerionItemIds[0], amountToBurn, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToBurn[0],
            zapper,
            zapperTokenId[1]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[1],
            amountToBurn.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToBurn.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        // #UW_DZAP_11_1.9 END

        // #UL_DPOS_11_2.1 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [(await getIdAndAddressFromEvents(txBD))["from"][0]],
                    [(await getIdAndAddressFromEvents(txBD))["address"][0]],
                    [(await getIdAndAddressFromEvents(txBD))["id"][0]],
                    [(await getIdAndAddressFromEvents(txBD))["amount"][0]]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Cannot unlock"
        );

        // #UL_DPOS_11_2.1 END

        // #UL_DPOS_DZAP_11_2.2 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [
                        (await getIdAndAddressFromEvents(txBD))["from"][0],
                        (await getIdAndAddressFromEvents(txBD))["from"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["address"][0],
                        (await getIdAndAddressFromEvents(txBD))["address"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["id"][0],
                        (await getIdAndAddressFromEvents(txBD))["id"][1],
                    ],
                    [0, (await getIdAndAddressFromEvents(txBD))["amount"][1]]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "amount"
        );

        // #UL_DPOS_DZAP_11_2.2 END

        // #UL_DPOS_DZAP_11_2.3 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [
                        (await getIdAndAddressFromEvents(txBD))["from"][0],
                        utilities.voidEthereumAddress,
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["address"][0],
                        (await getIdAndAddressFromEvents(txBD))["address"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["id"][0],
                        (await getIdAndAddressFromEvents(txBD))["id"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["amount"][0],
                        (await getIdAndAddressFromEvents(txBD))["amount"][1],
                    ]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "address"
        );

        // #UL_DPOS_DZAP_11_2.3 END

        // #UL_DPOS_DZAP_11_2.4 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [
                        (await getIdAndAddressFromEvents(txBD))["from"][0],
                        accounts[2],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["address"][0],
                        (await getIdAndAddressFromEvents(txBD))["address"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["id"][0],
                        (await getIdAndAddressFromEvents(txBD))["id"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["amount"][0],
                        (await getIdAndAddressFromEvents(txBD))["amount"][1],
                    ]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "reserve"
        );

        // #UL_DPOS_DZAP_11_2.4 END

        // #UL_DPOS_DZAP_11_2.5 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [
                        (await getIdAndAddressFromEvents(txBD))["from"][0],
                        (await getIdAndAddressFromEvents(txBD))["from"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["address"][0],
                        (await getIdAndAddressFromEvents(txBD))["address"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["id"][0],
                        (await getIdAndAddressFromEvents(txBD))["id"][1],
                    ],
                    [(await getIdAndAddressFromEvents(txBD))["amount"][0].div(2), 2]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "reserve"
        );

        // #UL_DPOS_DZAP_11_2.5 END

        // #UL_DPOS_DZAP_11_2.6 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [
                        (await getIdAndAddressFromEvents(txBD))["from"][0],
                        (await getIdAndAddressFromEvents(txBD))["from"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["address"][0],
                        (await getIdAndAddressFromEvents(txBD))["address"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["id"][0],
                        (await getIdAndAddressFromEvents(txBD))["id"][1],
                    ],
                    [(await getIdAndAddressFromEvents(txBD))["amount"][0].mul(2), 6]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "reserve"
        );

        // #UL_DPOS_DZAP_11_2.6 END

        // #UW_DPOS_DZAP_11_2.7 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osTokenAddresss, osTokenId[0], accounts[1], [key[0]], "0x"]
        );
        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperTokenAddresss, zapperTokenId[2], accounts[1], [key[1]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [amountToWrapBD[0].div(2), "2000000000000000000"];

        await catchCall(
            wrapper.methods
                .burnBatch(
                    accounts[2],
                    [itemIdsBD[0], itemIdsBD[1]],
                    amountToUnWrap,
                    encodeDatas
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DPOS_DZAP_11_2.7 END

        // #UL_DPOS_11_2.8 START

        var eliteAddresss = "0xd0B53410454370a482979C0adaf3667c6308a801";

        var eliteTokenId = ["0"];

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [
                        (await getIdAndAddressFromEvents(txBD))["from"][0],
                        accounts[1],
                        accounts[1],
                        accounts[1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["address"][0],
                        eliteAddresss,
                        (await getIdAndAddressFromEvents(txBD))["address"][0],
                        (await getIdAndAddressFromEvents(txBD))["address"][0],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["id"][0],
                        eliteTokenId[0],
                        eliteTokenId[0],
                        (await getIdAndAddressFromEvents(txAE))["id"][1],
                    ],
                    [
                        (await getIdAndAddressFromEvents(txBD))["amount"][0],
                        (await getIdAndAddressFromEvents(txBD))["amount"][0],
                        (await getIdAndAddressFromEvents(txBD))["amount"][0],
                        (await getIdAndAddressFromEvents(txBD))["amount"][0],
                    ]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "reserve"
        );

        // #UL_DPOS_11_2.8 END

        // #UW_DPOS_DZAP_11_2.9 START

        var amountToBurn = amountToWrapBD[0];

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [osTokenAddresss, osTokenId[0], accounts[1], [key[0]], "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[2], itemIdsBD[0], amountToBurn, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "Cannot unlock"
        );

        // #UW_DPOS_DZAP_11_2.9 END

        // #UL_DPOS_11_3.1 START

        var unlockTx = await wrapper.methods
            .unlockReserves(
                [(await getIdAndAddressFromEvents(txBD))["from"][0]],
                [(await getIdAndAddressFromEvents(txBD))["address"][0]],
                [(await getIdAndAddressFromEvents(txBD))["id"][0]],
                [(await getIdAndAddressFromEvents(txBD))["amount"][0]]
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[1],
                })
            );

        await wrapperResource.checkUnlockedAmount(unlockTx, (await getIdAndAddressFromEvents(txBD))["address"][0], (await getIdAndAddressFromEvents(txBD))["id"][0], [key[0]], wrapper, [0]);

        assert.equal((await wrapper.methods.reserveData(key[0]).call()).amount, "0");

        // #UL_DPOS_11_3.1 END

        // #UL_DZAP_11_3.2 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [(await getIdAndAddressFromEvents(txCF))["from"][0]],
                    [(await getIdAndAddressFromEvents(txCF))["address"][0]],
                    [(await getIdAndAddressFromEvents(txCF))["id"][0]],
                    [(await getIdAndAddressFromEvents(txCF))["amount"][0]]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "cannot unlock"
        );

        // #UL_DZAP_11_3.2 END

        // #UL_DZAP_11_3.3 START

        await catchCall(
            wrapper.methods
                .unlockReserves(
                    [(await getIdAndAddressFromEvents(txBD))["from"][0]],
                    [(await getIdAndAddressFromEvents(txBD))["address"][0]],
                    [(await getIdAndAddressFromEvents(txBD))["id"][0]],
                    ["0"]
                )
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[2],
                    })
                ),
            "amount"
        );

        // #UL_DZAP_11_3.3 END

        // #UW_DZAP_11_3.4 START

        var amountToBurn = "1000000000000000000";

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperTokenAddresss, zapperTokenId[0], accounts[1], [keyCF[0]], "0x"]
        );

        await catchCall(
            wrapper.methods
                .burn(accounts[1], zerionItemIds[0], amountToBurn, data)
                .send(
                    blockchainConnection.getSendingOptions({
                        from: accounts[1],
                    })
                ),
            "insuff"
        );

        // #UW_DZAP_11_3.4 END

        // #UW_DPOS_DZAP_11_3.5 START

        var datas = [];

        datas[0] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [
                osTokenAddresss,
                osTokenId[0],
                accounts[1],
                [utilities.voidBytes32],
                "0x",
            ]
        );

        datas[1] = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperTokenAddresss, zapperTokenId[0], accounts[1], [keyCF[0]], "0x"]
        );
        var encodeDatas = web3.eth.abi.encodeParameters(["bytes[]"], [datas]);

        var amountToUnWrap = [amountToWrapBD[0], "1000000000000000000"];

        var tx = await wrapper.methods
            .burnBatch(
                accounts[2],
                [itemIdsBD[0], zerionItemIds[0]],
                amountToUnWrap,
                encodeDatas
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[0],
            os,
            osTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToUnWrap[0].mul(-1),
            itemIdsBD[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[0].mul(-1),
            itemIdsBD[0],
            wrapper
        );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToUnWrap[1][0],
            zapper,
            zapperTokenId[0]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToUnWrap[1].mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToUnWrap[1].mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, zapperTokenAddresss, zapperTokenId[0], [keyCF[0]], wrapper, [amountToUnWrap[1][0]]);

        // #UW_DPOS_DZAP_11_3.5 END

        // #UW_DZAP_11_3.6 START
        var amountToBurn = "1000000000000000000";

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperTokenAddresss, zapperTokenId[2], accounts[1], [key[1]], "0x"]
        );

        await catchCall(wrapper.methods
            .burn(accounts[2], zerionItemIds[0], amountToBurn, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            ), "cannot unlock");
        // #UW_DZAP_11_3.6 END


        // JumpToBlock START

        await blockchainConnection.fastForward(blockToSkip);

        // JumpToBlock END

        // #UW_DZAP_11_3.7 START

        var amountToBurn = "1000000000000000000";

        var data = web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes32[]", "bytes"],
            [zapperTokenAddresss, zapperTokenId[2], accounts[1], [key[1]], "0x"]
        );

        var tx = await wrapper.methods
            .burn(accounts[2], zerionItemIds[0], amountToBurn, data)
            .send(
                blockchainConnection.getSendingOptions({
                    from: accounts[2],
                })
            );

        await wrapperResource.checkBalance1155(
            tx,
            wrapper.options.address,
            accounts[1],
            amountToBurn[0],
            zapper,
            zapperTokenId[2]
        );

        await wrapperResource.checkBalanceItem(
            tx,
            accounts[2],
            amountToBurn.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkSupply(
            tx,
            amountToBurn.mul(-1),
            zerionItemIds[0],
            wrapper
        );

        await wrapperResource.checkUnlockedAmount(tx, zapperTokenAddresss, zapperTokenId[2], [key[1]], wrapper, [amountToUnWrap[1][0]]);

        // #UW_DZAP_11_3.7 END
    });
});
