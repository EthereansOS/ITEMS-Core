var utilities = require("../util/utilities");
var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");
const blockchainConnection = require("../util/blockchainConnection");

describe("itemv2 projections ERC20Wrapper", () => {
    var wrapper;
    var MainInterface;
    var mainInterface;
    var ItemInteroperableInterface;
    var itemInteroperableInterface;
    var uniToken;
    var daiToken;
    var usdcToken;
    var wethToken;
    var hexToken;
    var celToken;
    var fegToken;
    var bombToken;
    var osToken;
    var erc20Contract;
    var erc20Contract1;
    var osErc20Contract;
    var ethErc20Contract;
    var host = "0xf1fced5b0475a935b49b95786adbda2d40794d2d";
    var itemInteroperableInterfaceAddress;
    var itemsList = [];
    var exec659 = false;
    var exec660 = false;
    var exec661 = false;
    var exec662 = false;

    async function buyForETH(token, amount, from) {
        var uniswapV2Router = new web3.eth.Contract(
            knowledgeBase.uniswapV2RouterABI,
            knowledgeBase.uniswapV2RouterAddress
        );
        var wethToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.wethTokenAddress
        );
        var path = [wethToken.options.address, token.options.address];
        var value = utilities.toDecimals(amount.toString(), "18");
        await uniswapV2Router.methods
            .swapExactETHForTokens(
                "1",
                path,
                (from && (from.from || from)) || accounts[0],
                parseInt(new Date().getTime() / 1000 + 1000)
            )
            .send(
                blockchainConnection.getSendingOptions({
                    from: (from && (from.from || from)) || accounts[0],
                    value,
                })
            );
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

    async function test659() {
        exec659 = true;

        await buyForETH(daiToken, 2, accounts[1]);
        await buyForETH(uniToken, 2, accounts[1]);

        var daiAmounts = (await daiToken.methods.balanceOf(accounts[1]).call()).div(
            2
        );
        var uniAmounts = (await uniToken.methods.balanceOf(accounts[1]).call()).div(
            2
        );
        var ethAmount = "1000000000000000000";
        var totalAmounts = [
            [uniAmounts, uniAmounts],
            [daiAmounts, daiAmounts],
            [ethAmount.div(2), ethAmount.div(2)],
        ];
        var receivers = [
            [accounts[2], utilities.voidEthereumAddress],
            [accounts[1], accounts[3]],
            [accounts[4], accounts[5]],
        ];
        var tokenAddress = [
            uniToken.options.address,
            daiToken.options.address,
            utilities.voidEthereumAddress,
        ];
        var tokenName = ["UNI", "DAI", "ETH"];
        await daiToken.methods
            .approve(
                wrapper.options.address,
                await daiToken.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await uniToken.methods
            .approve(
                wrapper.options.address,
                await uniToken.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        var res = await wrapperResource.revertMintErc20(
            wrapper,
            tokenAddress,
            totalAmounts,
            receivers,
            accounts[1],
            ethAmount
        );

        var itemList = [{
            header: {
                host: utilities.voidEthereumAddress,
                name: "item",
                symbol: "i",
                uri: "uriItem1",
            },
            collectionId: web3.eth.abi.encodeParameter("address", uniToken.options.address),
            id: "0",
            accounts: [],
            amounts: [uniAmounts, uniAmounts],
        }];

        await catchCall(wrapper.methods
            .mintItems(itemList)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] })), "length");

        var res = await wrapperResource.mintErc20(
            wrapper,
            tokenAddress,
            totalAmounts,
            receivers,
            accounts[1],
            ethAmount
        );

        var itemIds = res["itemIds"];

        await Promise.all(itemIds.map(async id => console.log(await mainInterface.methods.uri(id).call())));

        await Promise.all(
            itemIds.map(async(id, index) => {
                itemsList.push({
                    tokenName: tokenName[index],
                    tokenAddress: tokenAddress[index],
                    account: receivers[index],
                    itemId: id,
                    amounts: totalAmounts[index],
                });
            })
        );

        await wrapperResource.assertDecimals(wrapper, itemIds);

        await wrapperResource.assertCheckErc20ItemBalance(
            wrapper,
            receivers,
            itemIds,
            totalAmounts
        );

        var rubboTutto = "0x2fd0eb27494d7a336574919fc670c05adbf65c80";
        try {
            await blockchainConnection.unlockAccounts(rubboTutto);
        } catch(e) {}

        var itemList = [{
            header: {
                host: utilities.voidEthereumAddress,
                name: "item",
                symbol: "i",
                uri: "uriItem1",
            },
            collectionId: web3.eth.abi.encodeParameter("address", uniToken.options.address),
            id: "0",
            accounts: [],
            amounts: [uniAmounts],
        }];

        await uniToken.methods
            .approve(
                wrapper.options.address,
                await uniToken.methods.balanceOf(rubboTutto).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: rubboTutto }));

        await wrapper.methods
            .mintItems(itemList)
            .send(blockchainConnection.getSendingOptions({ from: rubboTutto }));
    }

    async function test660() {
        exec660 = true;

        await buyForETH(usdcToken, 2, accounts[1]);
        await buyForETH(hexToken, 2, accounts[1]);
        await buyForETH(celToken, 2, accounts[1]);

        var usdcAmounts = (
            await usdcToken.methods.balanceOf(accounts[1]).call()
        ).div(2);
        var hexAmounts = (await hexToken.methods.balanceOf(accounts[1]).call()).div(
            2
        );
        var celAmounts = (await celToken.methods.balanceOf(accounts[1]).call()).div(
            2
        );
        var totalAmounts = [
            [usdcAmounts, usdcAmounts],
            [hexAmounts, hexAmounts],
            [celAmounts, celAmounts],
        ];
        var receivers = [
            [accounts[2], utilities.voidEthereumAddress],
            [accounts[1], accounts[3]],
            [accounts[4], accounts[5]],
        ];
        var tokenAddress = [
            usdcToken.options.address,
            hexToken.options.address,
            celToken.options.address,
        ];
        var tokenName = ["USDC", "HEX", "CEL"];

        var tokenDecimal = [6, 8, 4];
        await usdcToken.methods
            .approve(
                wrapper.options.address,
                await usdcToken.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await hexToken.methods
            .approve(
                wrapper.options.address,
                await hexToken.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await celToken.methods
            .approve(
                wrapper.options.address,
                await celToken.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        var res = await wrapperResource.mintErc20(
            wrapper,
            tokenAddress,
            totalAmounts,
            receivers,
            accounts[1]
        );

        var itemIds = res["itemIds"];

        await Promise.all(
            itemIds.map(async(id, index) => {
                itemsList.push({
                    tokenName: tokenName[index],
                    tokenAddress: tokenAddress[index],
                    account: receivers[index],
                    itemId: id,
                    amounts: totalAmounts[index],
                });
            })
        );

        await wrapperResource.assertDecimals(wrapper, itemIds);

        totalAmounts = await Promise.all(
            totalAmounts.map(async(amount, index) => {
                return await Promise.all(
                    amount.map(async(am, ind) => {
                        return utilities.normalizeValue(am, tokenDecimal[index]);
                    })
                );
            })
        );

        await wrapperResource.assertCheckErc20ItemBalance(
            wrapper,
            receivers,
            itemIds,
            totalAmounts
        );
    }

    async function test661() {
        exec661 = true;

        var prev = "2000000000000000000";
        await osToken.methods
            .transfer(accounts[1], prev)
            .send(blockchainConnection.getSendingOptions({ from: host }));

        var totalAmounts = [
            [prev.div(2)],
            [prev.div(2)],
            [prev.div(2)],
            [prev.div(2)],
        ];
        var receivers = [
            [accounts[4]],
            [accounts[5]],
            [accounts[6]],
            [accounts[7]],
        ];
        var tokenAddress = [
            osToken.options.address,
            osToken.options.address,
            utilities.voidEthereumAddress,
            utilities.voidEthereumAddress,
        ];
        var tokenName = ["Os", "ethInteroperable"];

        await osToken.methods
            .approve(
                wrapper.options.address,
                await osToken.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        var res = await wrapperResource.mintErc20(
            wrapper,
            tokenAddress,
            totalAmounts,
            receivers,
            accounts[1],
            prev
        );

        res.itemIds.length > 1 
        ? itemIds = [res.itemIds[0], res.itemIds[0], res.itemIds[1], res.itemIds[1]]
        : itemIds = [res.itemIds[0], res.itemIds[0], itemsList[2].itemId, itemsList[2].itemId];

        await wrapperResource.assertCheckErc20ItemBalance(
            wrapper,
            receivers,
            itemIds,
            totalAmounts
        );

        var osItemId = res["itemIds"];

        osErc20Contract = await asInteroperableInterface(osItemId[0]);

        var item = [];

        var res = await itemsv2.createCollection(accounts[1], item);
        var collectionId = res["collectionId"];

        var CreateItem = [{
                header: {
                    host: accounts[1],
                    name: "Item1",
                    symbol: "I1",
                    uri: "uriItem1",
                },
                collectionId: collectionId,
                id: 0,
                accounts: [accounts[1]],
                amounts: ["10000000000000000"],
            },
            {
                header: {
                    host: accounts[1],
                    name: "Item2",
                    symbol: "I2",
                    uri: "uriItem2",
                },
                collectionId: collectionId,
                id: 0,
                accounts: [accounts[1]],
                amounts: ["10000000000000000"],
            },
        ];

        var mintItem = await res.projection.methods
            .mintItems(CreateItem)
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        var idItems = mintItem.events.CollectionItem.map(
            (event) => event.returnValues["itemId"]
        );
        erc20Contract = await asInteroperableInterface(idItems[0]);
        erc20Contract1 = await asInteroperableInterface(idItems[1]);

        var totalAmounts = [
            ["1000000000000", "3000000000000000"],
            ["10000000000000", "200000000000000"],
        ];
        var receivers = [
            [accounts[2], utilities.voidEthereumAddress],
            [accounts[1], accounts[3]],
        ];
        var tokenAddress = [
            erc20Contract.options.address,
            erc20Contract1.options.address,
        ];
        var tokenName = ["interoperable", "interoperable1", "OS"];

        await erc20Contract.methods
            .approve(
                wrapper.options.address,
                await erc20Contract.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await erc20Contract1.methods
            .approve(
                wrapper.options.address,
                await erc20Contract1.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        var res = await wrapperResource.mintErc20(
            wrapper,
            tokenAddress,
            totalAmounts,
            receivers,
            accounts[1]
        );

        itemIds = res["itemIds"];

        await wrapperResource.assertCheckErc20ItemBalance(
            wrapper,
            receivers,
            itemIds,
            totalAmounts
        );

        itemIds = itemIds.concat([
            await wrapper.methods.itemIdOf(knowledgeBase.osTokenAddress).call(),
        ]);
        tokenAddress.push(knowledgeBase.osTokenAddress);
        receivers.push([accounts[4], accounts[5]]);
        totalAmounts.push(["1000000000000000000", "1000000000000000000"]);

        itemIds = itemIds.concat([
            await wrapper.methods.itemIdOf(utilities.voidEthereumAddress).call(),
        ]);
        tokenAddress.push(utilities.voidEthereumAddress);
        receivers.push([accounts[4], accounts[5]]);
        totalAmounts.push(["1000000000000000000", "1000000000000000000"]);

        await Promise.all(
            itemIds.map(async(id, index) => {
                itemsList.push({
                    tokenName: tokenName[index],
                    tokenAddress: tokenAddress[index],
                    account: receivers[index],
                    itemId: id,
                    amounts: totalAmounts[index],
                });
            })
        );
    }

    async function test662() {
        exec662 = true;

        await buyForETH(bombToken, 2, accounts[1]);

        var bombAmounts = (
            await bombToken.methods.balanceOf(accounts[1]).call()
        ).div(2);

        var totalAmounts = [
            [bombAmounts, bombAmounts]
        ];
        var receivers = [
            [accounts[2], utilities.voidEthereumAddress]
        ];
        var tokenAddress = [bombToken.options.address];
        var tokenDecimal = [0];
        var tokenName = ["bomb"];

        await bombToken.methods
            .approve(
                wrapper.options.address,
                await bombToken.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        await wrapperResource.revertMintErc20Wrapper(
            wrapper,
            tokenAddress,
            totalAmounts,
            receivers,
            accounts[1],
            bombAmounts
        );

        totalAmounts = [
            [bombAmounts]
        ];
        receivers = [
            [accounts[2]]
        ];
        tokenAddress = [bombToken.options.address];
        await bombToken.methods
            .approve(
                wrapper.options.address,
                await bombToken.methods.balanceOf(accounts[1]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

        var prevSupply = await bombToken.methods
            .balanceOf(wrapper.options.address)
            .call();

        var res = await wrapperResource.mintErc20(
            wrapper,
            tokenAddress,
            totalAmounts,
            receivers,
            accounts[1]
        );

        var itemIds = res["itemIds"];

        var postSupply = await bombToken.methods
            .balanceOf(wrapper.options.address)
            .call();

        var sentAmount = postSupply.sub(prevSupply);
        var burntAmount = bombAmounts.sub(sentAmount);

        await Promise.all(
            itemIds.map(async(id, index) => {
                itemsList.push({
                    tokenName: tokenName[index],
                    tokenAddress: tokenAddress[index],
                    account: receivers[index],
                    itemId: id,
                    amounts: totalAmounts[index],
                });
            })
        );

        var tx = res["tx"];
        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

        await wrapperResource.assertDecimals(wrapper, itemIds);
        totalAmounts = [
            [utilities.normalizeValue(bombAmounts.sub(burntAmount), tokenDecimal[0])],
        ];
        await wrapperResource.assertCheckErc20ItemBalance(
            wrapper,
            receivers,
            itemIds,
            totalAmounts
        );

        var prevSupply = await wrapper.methods.totalSupply(itemIds[0]).call();

        await wrapper.methods
            .safeTransferFrom(
                accounts[2],
                accounts[7],
                itemIds[0],
                await wrapper.methods.balanceOf(accounts[2], itemIds[0]).call(),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[2] }));

        assert.equal(
            await wrapper.methods.totalSupply(itemIds[0]).call(),
            prevSupply
        );

        await wrapper.methods
            .safeTransferFrom(
                accounts[7],
                accounts[2],
                itemIds[0],
                await wrapper.methods.balanceOf(accounts[7], itemIds[0]).call(),
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));
    }

    before(async() => {
        uniToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.uniTokenAddress
        );
        daiToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.daiTokenAddress
        );
        wethToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.wethTokenAddress
        );
        usdcToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.usdcTokenAddress
        );
        hexToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.hexTokenAddress
        );
        celToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.celTokenAddress
        );
        fegToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.fegTokenAddress
        );
        bombToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.bombTokenAddress
        );
        osToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            knowledgeBase.osTokenAddress
        );
        await blockchainConnection.unlockAccounts(host);
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

        var ERC20WrapperUriRenderer = await compile('projection/ERC20/ERC20WrapperUriRenderer');

        var erc20WrapperUriRenderer = new web3.eth.Contract(ERC20WrapperUriRenderer.abi);
        var deployRoutine = erc20WrapperUriRenderer.deploy({data : ERC20WrapperUriRenderer.bin, arguments : [utilities.voidEthereumAddress, "myUri"]});
        deployRoutine = deployRoutine.send(blockchainConnection.getSendingOptions());
        erc20WrapperUriRenderer = await deployRoutine;

        var uri = web3.eth.abi.encodeParameters(["address", "bytes"], [erc20WrapperUriRenderer.options.address, "0x"]);

        var headerCollection = {
            host: accounts[1],
            name: "Colection1",
            symbol: "C1",
            uri
        };

        var items = [];

        var deployParam = abi.encode(
            [
                "bytes32",
                "tuple(address,string,string,string)",
                "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
                "bytes",
            ], [
                utilities.voidBytes32,
                await itemsv2.convertHeader(headerCollection),
                items,
                utilities.voidBytes32,
            ]
        );

        mainInterface = await itemsv2.getMainInterface();

        deployParam = abi.encode(["address", "bytes"], [accounts[1], deployParam]);

        var ERC20Wrapper = await compile("projection/ERC20/ERC20Wrapper");
        var wrapperData = await new web3.eth.Contract(ERC20Wrapper.abi)
            .deploy({ data: ERC20Wrapper.bin, arguments: ["0x"] }).encodeABI();

        var data = await itemsv2.createCollection(headerCollection.host, items, wrapperData, "0x", headerCollection);

        wrapper = new web3.eth.Contract(ERC20Wrapper.abi, data.projection.options.address);

        console.log("Wrapper Uri", await wrapper.methods.uri().call());
        assert.equal(await wrapper.methods.uri().call(), await mainInterface.methods.collectionUri(await wrapper.methods.collectionId().call()).call());
    });

    it("#659 Wrap ERC20 (18 decimals) and ETH", async() => {
        /**
         * Authorized subjects:
         * ERC20 holder holders
         * approved operator address
         * Functions used in the test:
         * mint(address[] calldata tokenAddresses, uint256[][] calldata amounts, address[][] calldata receivers)
         * Items used: Item1, Item2, Item3.
         *
         * Wrap ETH, UNI and DAI using the mint function passing multiple amounts and receivers (msg.sender + other addresses) for each token.
         */
        await test659();
    });

    it("#660 Wrap ERC20 (decimals different from 18)", async() => {
        /**
         * Authorized subjects:
         * ERC20 holders
         * approved operator address
         * Functions used in the test:
         * mint(address[] calldata tokenAddresses, uint256[][] calldata amounts, address[][] calldata receivers)
         * Items used: Item4, Item5, Item6.
         *
         * Wrap USDC, HEX, CEL (celsius) using the mint function passing multiple amounts and receivers (msg.sender + other addresses) for each token.
         */
        await test660();
    });

    it("#661 Wrap ERC20 (Item Interoperable)", async() => {
        /**
         * Authorized subjects:
         * ERC20 holders
         * approved operator address
         * Functions used in the test:
         * mint(address[] calldata tokenAddresses, uint256[][] calldata amounts, address[][] calldata receivers)
         * Items used: Item1, Item7, Item8, Item9
         *
         * Wrap ETH and 3 Items using their Interoperable Interface using the mint function passing multiple amounts and receivers (msg.sender + other addresses) for each token.
         */
        await test661();
    });

    it("#662 Wrap ERC20 (deflationary token)", async() => {
        /**
         * Authorized subjects:
         * ERC20 holders
         * approved operator address
         * Functions used in the test:
         * mint(address[] calldata tokenAddresses, uint256[][] calldata amounts, address[][] calldata receivers)
         * Items used: Item10
         *
         * Must fail: Wrap BOMB using the mint function passing multiple amounts and receivers (msg.sender + other addresses) for each token. revert witrh Only single transfers allowed for this token
         * Wrap BOMB using the mint function passing a single amount and receiver
         */
        await test662();
    });

    it("#663 Unwrap ERC20 (18 decimals) and ETH", async() => {
        /**
         * Authorized subjects:
         * Item holders
         * approved operator address
         * Functions used in the test:
         * Burn(address account, uint256 itemId, uint256 amount, bytes memory data)
         * burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data)
         * Items used: Item1, Item2, Item3
         *
         * Unwrap ETH using the burn function
         * Unwrap UNI using the burn function passing a receiver different from msg.sender
         * Unwrap DAI from an approved operator.
         * Unwrap ETH, UNI and DAI using the burnBatch function passing a different receiver (msg.sender + other addresses) for each token.
         */
        if (!exec659) await test659();
        var tokenContractList = [uniToken, daiToken];

        var acc =
            itemsList[0].account[0] == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[0].account[0];
        var burnAmounts = ["100000000000000", "20000000000000", "1000000000"];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[0].tokenAddress, accounts[6]]
        );
        var prevBal = await uniToken.methods.balanceOf(accounts[6]).call();
        var prevSupply = await wrapper.methods
            .totalSupply(itemsList[0].itemId)
            .call();

        await catchCall(
            wrapper.methods
            .burn(utilities.voidEthereumAddress, itemsList[0].itemId, burnAmounts[0], burn)
            .send(blockchainConnection.getSendingOptions({ from: acc })),
            "required account");

        var wrongBurn = web3.eth.abi.encodeParameters(
            ["address", "address"], [accounts[0], accounts[6]]
        );

        await catchCall(wrapper.methods
            .burn(acc, itemsList[0].itemId, burnAmounts[0], wrongBurn)
            .send(blockchainConnection.getSendingOptions({ from: acc })), "Wrong ERC20");

        await wrapper.methods
            .burn(acc, itemsList[0].itemId, burnAmounts[0], burn)
            .send(blockchainConnection.getSendingOptions({ from: acc }));
        assert.equal(
            prevSupply.sub(burnAmounts[0]),
            await wrapper.methods.totalSupply(itemsList[0].itemId).call()
        );
        assert.equal(
            await uniToken.methods.balanceOf(accounts[6]).call(),
            prevBal.add(burnAmounts[0])
        );

        var acc =
            itemsList[1].account[0] == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[1].account[0];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[1].tokenAddress, utilities.voidEthereumAddress]
        );
        var prevBal = await daiToken.methods.balanceOf(acc).call();
        await mainInterface.methods
            .approve(acc, accounts[9], "1000000000000000000", itemsList[1].itemId)
            .send(blockchainConnection.getSendingOptions({ from: acc }));
        var prevSupply = await wrapper.methods
            .totalSupply(itemsList[1].itemId)
            .call();
        await wrapper.methods
            .burn(acc, itemsList[1].itemId, "100000000000000", burn)
            .send(blockchainConnection.getSendingOptions({ from: accounts[9] }));
        assert.equal(
            prevSupply.sub("100000000000000"),
            await wrapper.methods.totalSupply(itemsList[1].itemId).call()
        );
        assert.equal(
            await daiToken.methods.balanceOf(acc).call(),
            prevBal.add("100000000000000")
        );

        acc =
            acc == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[2].account[0];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[2].tokenAddress, utilities.voidEthereumAddress]
        );
        var prevBal = await web3.eth.getBalance(acc);
        var tx = await wrapper.methods
            .burn(acc, itemsList[2].itemId, burnAmounts[2], burn)
            .send(blockchainConnection.getSendingOptions({ from: acc }));
        assert.equal(
            await web3.eth.getBalance(acc),
            prevBal.add(burnAmounts[2]).sub(await blockchainConnection.calculateTransactionFee(tx))
        );

        await catchCall(
            wrapper.methods
            .safeTransferFrom(
                utilities.voidEthereumAddress,
                accounts[5],
                itemsList[0].itemId,
                '100000000',
                "0x",
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
            "required from");

        await catchCall(
            wrapper.methods
            .safeTransferFrom(
                utilities.voidEthereumAddress,
                utilities.voidEthereumAddress,
                itemsList[0].itemId,
                '100000000',
                "0x",
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
            "required from");

        await catchCall(
            wrapper.methods
            .safeTransferFrom(
                accounts[5],
                utilities.voidEthereumAddress,
                itemsList[0].itemId,
                '100000000',
                "0x",
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
            "required to");

        await Promise.all(
            itemsList.slice(0, 3).map(async(item, index) => {
                await Promise.all(
                    item.account.map(async(acc, i) => {
                        acc = acc == utilities.voidEthereumAddress ? accounts[1] : acc;
                        await wrapper.methods
                            .safeTransferFrom(
                                acc,
                                accounts[7],
                                item.itemId,
                                await wrapper.methods.balanceOf(acc, item.itemId).call(),
                                "0x"
                            )
                            .send(blockchainConnection.getSendingOptions({ from: acc }));
                    })
                );
            })
        );

        var items = [];
        await Promise.all(
            itemsList.slice(0, 3).map(async(item, index) => {
                await Promise.all(
                    item.amounts.map((am, i) => {
                        items.push(item.itemId);
                    })
                );
            })
        );
        var amounts = [
            ["100000000", "300000000"],
            ["2000000000", "100000000"],
            ["100000000", "3000000000"],
        ];

        var batchAmounts = [
            "100000000",
            "300000000",
            "2000000000",
            "100000000",
            "100000000",
            "3000000000",
        ];

        var batchReceivers = [
            [accounts[0], utilities.voidEthereumAddress],
            [accounts[2], accounts[3]],
            [accounts[4], accounts[5]],
        ];

        var burn = [];

        await Promise.all(
            itemsList.slice(0, 3).map(async(item, index) => {
                await Promise.all(
                    item.account.map(async(acc, i) => {
                        burn.push(
                            web3.eth.abi.encodeParameters(
                                ["address", "uint256"], [item.tokenAddress, batchReceivers[index][i]]
                            )
                        );
                    })
                );
            })
        );

        var prevBal = await Promise.all(
            itemsList.slice(0, 3).map(async(item, index) => {
                return await Promise.all(
                    item.account.map(async(am, i) => {
                        return item.tokenName != "ETH" ?
                            await tokenContractList[index].methods
                            .balanceOf(
                                batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                accounts[7] :
                                batchReceivers[index][i]
                            )
                            .call() :
                            await web3.eth.getBalance(
                                batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                accounts[7] :
                                batchReceivers[index][i]
                            );
                    })
                );
            })
        );

        var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

        var previousTotalSupply = await Promise.all(
            itemsList.slice(0, 3).map(async(item, index) => {
                return await wrapper.methods.totalSupply(item.itemId).call();
            })
        );

        await catchCall(wrapper.methods
            .safeBatchTransferFrom(
                utilities.voidEthereumAddress,
                accounts[9],
                items,
                batchAmounts,
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "required from");

        await catchCall(wrapper.methods
            .safeBatchTransferFrom(
                accounts[7],
                utilities.voidEthereumAddress,
                items,
                batchAmounts,
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "required to");

        await catchCall(wrapper.methods
            .safeBatchTransferFrom(
                utilities.voidEthereumAddress,
                utilities.voidEthereumAddress,
                items,
                batchAmounts,
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "required from");

        await wrapper.methods
            .safeBatchTransferFrom(
                accounts[7],
                accounts[9],
                items,
                batchAmounts,
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));

        await wrapper.methods
            .safeBatchTransferFrom(
                accounts[9],
                accounts[7],
                items,
                batchAmounts,
                "0x"
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[9] }));

        await catchCall(
            wrapper.methods
            .burnBatch(utilities.voidEthereumAddress, items, batchAmounts, datas)
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "required account"
        );

        var tx = await wrapper.methods
            .burnBatch(accounts[7], items, batchAmounts, datas)
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));

        await Promise.all(
            itemsList.slice(0, 3).map(async(item, index) => {
                assert.equal(
                    await wrapper.methods.totalSupply(item.itemId).call(),
                    previousTotalSupply[index].sub(
                        amounts[index].reduce((total, arg) => total.add(arg), 0)
                    )
                );
            })
        );

        await Promise.all(
            itemsList.slice(0, 3).map(async(item, index) => {
                await Promise.all(
                    item.account.map(async(am, i) => {
                        item.tokenName != "ETH" ?
                            assert.equal(
                                await tokenContractList[index].methods
                                .balanceOf(
                                    batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                    accounts[7] :
                                    batchReceivers[index][i]
                                )
                                .call(),
                                prevBal[index][i].add(amounts[index][i])
                            ) :
                            assert.equal(
                                await web3.eth.getBalance(
                                    batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                    accounts[7] :
                                    batchReceivers[index][i]
                                ),
                                prevBal[index][i].add(amounts[index][i])
                            );
                    })
                );
            })
        );
    });

    it("#664 Unwrap ERC20 (decimals different from 18)", async() => {
        /**
         * Authorized subjects:
         * Item holders
         * approved operator address
         * Functions used in the test:
         * Burn(address account, uint256 itemId, uint256 amount, bytes memory data)
         * burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data)
         * Items used: Item4, Item5, Item6
         *
         * Unwrap USDC using the burn function.
         * Unwrap USDC, HEX, CEL (celsius) using the burnBatch function passing a different receiver (msg.sender + other addresses) for each token.
         */
        if (!exec659) await test659();
        if (!exec660) await test660();
        var tokenContractList = [usdcToken, hexToken, celToken];
        var tokenDecDiff = [1e12, 1e10, 1e14];
        var catchCallAmount = [1e11, 1e9, 1e13];
        var amount = [1e12, 1e10, 1e14];
        // USDC
        var acc =
            itemsList[3].account[0] == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[3].account[0];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[3].tokenAddress, accounts[6]]
        );
        var prevBal = await usdcToken.methods.balanceOf(accounts[6]).call();
        var prevSupply = await wrapper.methods
            .totalSupply(itemsList[3].itemId)
            .call();
        await wrapper.methods
            .burn(acc, itemsList[3].itemId, amount[0], burn)
            .send(blockchainConnection.getSendingOptions({ from: acc }));
        assert.equal(
            prevSupply.sub(amount[0]),
            await wrapper.methods.totalSupply(itemsList[3].itemId).call()
        );
        assert.equal(
            await usdcToken.methods.balanceOf(accounts[6]).call(),
            prevBal.add(amount[0].div(tokenDecDiff[0]))
        );

        // HEX
        var acc =
            itemsList[4].account[0] == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[4].account[0];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[4].tokenAddress, accounts[6]]
        );

        var burnCatchCall = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[0].tokenAddress, accounts[6]]
        );

        var prevBal = await hexToken.methods.balanceOf(accounts[6]).call();
        var prevSupply = await wrapper.methods
            .totalSupply(itemsList[4].itemId)
            .call();

        await catchCall(
            wrapper.methods
            .burn(acc, itemsList[4].itemId, amount[1], burnCatchCall)
            .send(blockchainConnection.getSendingOptions({ from: acc })),
            "Wrong ERC20"
        );

        await wrapper.methods
            .burn(acc, itemsList[4].itemId, amount[1], burn)
            .send(blockchainConnection.getSendingOptions({ from: acc }));
        assert.equal(
            prevSupply.sub(amount[1]),
            await wrapper.methods.totalSupply(itemsList[4].itemId).call()
        );
        assert.equal(
            await hexToken.methods.balanceOf(accounts[6]).call(),
            prevBal.add(amount[1].div(tokenDecDiff[1]))
        );

        // CEL
        var acc =
            itemsList[5].account[0] == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[5].account[0];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[5].tokenAddress, accounts[6]]
        );
        var prevBal = await celToken.methods.balanceOf(accounts[6]).call();
        var prevSupply = await wrapper.methods
            .totalSupply(itemsList[5].itemId)
            .call();
        await wrapper.methods
            .burn(acc, itemsList[5].itemId, amount[2], burn)
            .send(blockchainConnection.getSendingOptions({ from: acc }));
        assert.equal(
            prevSupply.sub(amount[2]),
            await wrapper.methods.totalSupply(itemsList[5].itemId).call()
        );
        assert.equal(
            await celToken.methods.balanceOf(accounts[6]).call(),
            prevBal.add(amount[2].div(tokenDecDiff[2]))
        );

        // USDC catchCall
        var acc =
            itemsList[3].account[0] == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[3].account[0];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[3].tokenAddress, accounts[6]]
        );
        var prevBal = await usdcToken.methods.balanceOf(accounts[6]).call();
        var prevSupply = await wrapper.methods
            .totalSupply(itemsList[3].itemId)
            .call();
        await catchCall(
            wrapper.methods
            .burn(acc, itemsList[3].itemId, catchCallAmount[0], burn)
            .send(blockchainConnection.getSendingOptions({ from: acc })),
            "Insufficient amount"
        );

        // HEX catchCall
        var acc =
            itemsList[4].account[0] == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[4].account[0];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[4].tokenAddress, accounts[6]]
        );
        var prevBal = await usdcToken.methods.balanceOf(accounts[6]).call();
        var prevSupply = await wrapper.methods
            .totalSupply(itemsList[4].itemId)
            .call();
        await catchCall(
            wrapper.methods
            .burn(acc, itemsList[4].itemId, catchCallAmount[1], burn)
            .send(blockchainConnection.getSendingOptions({ from: acc })),
            "Insufficient amount"
        );

        // CEL catchCall
        var acc =
            itemsList[5].account[0] == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[5].account[0];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[5].tokenAddress, accounts[6]]
        );
        var prevBal = await usdcToken.methods.balanceOf(accounts[6]).call();
        var prevSupply = await wrapper.methods
            .totalSupply(itemsList[5].itemId)
            .call();
        await catchCall(
            wrapper.methods
            .burn(acc, itemsList[5].itemId, catchCallAmount[2], burn)
            .send(blockchainConnection.getSendingOptions({ from: acc })),
            "Insufficient amount"
        );

        await Promise.all(
            itemsList.slice(3, 6).map(async(item, index) => {
                await Promise.all(
                    item.account.map(async(acc, i) => {
                        acc = acc == utilities.voidEthereumAddress ? accounts[1] : acc;
                        await wrapper.methods
                            .safeTransferFrom(
                                acc,
                                accounts[7],
                                item.itemId,
                                await wrapper.methods.balanceOf(acc, item.itemId).call(),
                                "0x"
                            )
                            .send(blockchainConnection.getSendingOptions({ from: acc }));
                    })
                );
            })
        );

        var items = [];
        await Promise.all(
            itemsList.slice(3, 6).map(async(item, index) => {
                await Promise.all(
                    item.amounts.map((am, i) => {
                        items.push(item.itemId);
                    })
                );
            })
        );
        var amounts = [
            ["100000000000000000", "300000000000000000"],
            ["200000000000000000", "10000000000000000"],
            ["20000000000000000", "300000000000000000"],
        ];

        var batchAmounts = [
            "100000000000000000",
            "300000000000000000",
            "200000000000000000",
            "10000000000000000",
            "20000000000000000",
            "300000000000000000",
        ];

        catchCallAmounts = [1e11, 1e11, 1e9, 1e9, 1e13, 1e13];

        var batchReceivers = [
            [accounts[0], utilities.voidEthereumAddress],
            [accounts[2], accounts[3]],
            [accounts[4], accounts[5]],
        ];

        var burn = [];

        await Promise.all(
            itemsList.slice(3, 6).map(async(item, index) => {
                await Promise.all(
                    item.account.map(async(acc, i) => {
                        burn.push(
                            web3.eth.abi.encodeParameters(
                                ["address", "uint256"], [item.tokenAddress, batchReceivers[index][i]]
                            )
                        );
                    })
                );
            })
        );

        var prevBal = await Promise.all(
            itemsList.slice(3, 6).map(async(item, index) => {
                return await Promise.all(
                    item.account.map(async(am, i) => {
                        return item.tokenName != "ETH" ?
                            await tokenContractList[index].methods
                            .balanceOf(
                                batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                accounts[7] :
                                batchReceivers[index][i]
                            )
                            .call() :
                            await web3.eth.getBalance(
                                batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                accounts[7] :
                                batchReceivers[index][i]
                            );
                    })
                );
            })
        );

        var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

        var previousTotalSupply = await Promise.all(
            itemsList.slice(3, 6).map(async(item, index) => {
                return await wrapper.methods.totalSupply(item.itemId).call();
            })
        );

        await wrapper.methods
            .burnBatch(accounts[7], items, batchAmounts, datas)
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));

        await catchCall(
            wrapper.methods
            .burnBatch(accounts[7], items, catchCallAmounts, datas)
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
            "Insufficient amount"
        );

        await Promise.all(
            itemsList.slice(3, 6).map(async(item, index) => {
                assert.equal(
                    await wrapper.methods.totalSupply(item.itemId).call(),
                    previousTotalSupply[index].sub(
                        amounts[index].reduce((total, arg) => total.add(arg), 0)
                    )
                );
            })
        );

        await Promise.all(
            itemsList.slice(3, 6).map(async(item, index) => {
                await Promise.all(
                    item.account.map(async(am, i) => {
                        item.tokenName != "ETH" ?
                            assert.equal(
                                await tokenContractList[index].methods
                                .balanceOf(
                                    batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                    accounts[7] :
                                    batchReceivers[index][i]
                                )
                                .call(),
                                prevBal[index][i].add(amounts[index][i] / tokenDecDiff[index])
                            ) :
                            assert.equal(
                                await web3.eth.getBalance(
                                    batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                    accounts[7] :
                                    batchReceivers[index][i]
                                ),
                                prevBal[index][i].add(amounts[index][i])
                            );
                    })
                );
            })
        );
    });

    it("#665 Unwrap ERC20 (Item Interoperable)", async() => {
        /**
         * Authorized subjects:
         * Item holders
         * approved operator address
         * Functions used in the test:
         * Burn(address account, uint256 itemId, uint256 amount, bytes memory data)
         * burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data)
         * Items used: Item1, Item7, Item8, Item9
         *
         *Unwrap ETH and 3 Items using the burnBatch function passing different receivers (msg.sender + other addresses) for each token.
         */
        if (!exec659) await test659();
        if (!exec660) await test660();
        if (!exec661) await test661();
        console.log(itemsList);
        var tokenContractList = [erc20Contract, erc20Contract1, osToken];

        await Promise.all(
            itemsList.slice(6, 10).map(async(item, index) => {
                await Promise.all(
                    item.account.map(async(acc, i) => {
                        acc = acc == utilities.voidEthereumAddress ? accounts[1] : acc;
                        await wrapper.methods
                            .safeTransferFrom(
                                acc,
                                accounts[7],
                                item.itemId,
                                await wrapper.methods.balanceOf(acc, item.itemId).call(),
                                "0x"
                            )
                            .send(blockchainConnection.getSendingOptions({ from: acc }));
                    })
                );
            })
        );

        var items = [];
        await Promise.all(
            itemsList.slice(6, 10).map(async(item, index) => {
                await Promise.all(
                    item.amounts.map((am, i) => {
                        items.push(item.itemId);
                    })
                );
            })
        );
        var amounts = [
            ["100000000", "300000000"],
            ["2000000000", "100000000"],
            ["100000000", "3000000000"],
            ["100000000", "3000000000"],
        ];

        var batchAmounts = [
            "100000000",
            "300000000",
            "2000000000",
            "100000000",
            "100000000",
            "3000000000",
            "100000000",
            "3000000000",
        ];

        var batchReceivers = [
            [accounts[0], utilities.voidEthereumAddress],
            [accounts[2], accounts[3]],
            [accounts[4], accounts[5]],
            [accounts[4], accounts[5]],
        ];

        var burn = [];

        await Promise.all(
            itemsList.slice(6, 10).map(async(item, index) => {
                await Promise.all(
                    item.account.map(async(acc, i) => {
                        burn.push(
                            web3.eth.abi.encodeParameters(
                                ["address", "uint256"], [item.tokenAddress, batchReceivers[index][i]]
                            )
                        );
                    })
                );
            })
        );

        var prevBal = await Promise.all(
            itemsList.slice(6, 10).map(async(item, index) => {
                return await Promise.all(
                    item.account.map(async(am, i) => {
                        return item.tokenAddress != utilities.voidEthereumAddress ?
                            await tokenContractList[index].methods
                            .balanceOf(
                                batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                accounts[7] :
                                batchReceivers[index][i]
                            )
                            .call() :
                            await web3.eth.getBalance(
                                batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                accounts[7] :
                                batchReceivers[index][i]
                            );
                    })
                );
            })
        );

        var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

        var previousTotalSupply = await Promise.all(
            itemsList.slice(6, 10).map(async(item, index) => {
                return await wrapper.methods.totalSupply(item.itemId).call();
            })
        );

        await wrapper.methods
            .burnBatch(accounts[7], items, batchAmounts, datas)
            .send(blockchainConnection.getSendingOptions({ from: accounts[7] }));

        await Promise.all(
            itemsList.slice(6, 10).map(async(item, index) => {
                assert.equal(
                    await wrapper.methods.totalSupply(item.itemId).call(),
                    previousTotalSupply[index].sub(
                        amounts[index].reduce((total, arg) => total.add(arg), 0)
                    )
                );
            })
        );

        await Promise.all(
            itemsList.slice(6, 10).map(async(item, index) => {
                await Promise.all(
                    item.account.map(async(am, i) => {
                        item.tokenAddress != utilities.voidEthereumAddress ?
                            assert.equal(
                                await tokenContractList[index].methods
                                .balanceOf(
                                    batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                    accounts[7] :
                                    batchReceivers[index][i]
                                )
                                .call(),
                                prevBal[index][i].add(amounts[index][i])
                            ) :
                            assert.equal(
                                await web3.eth.getBalance(
                                    batchReceivers[index][i] == utilities.voidEthereumAddress ?
                                    accounts[7] :
                                    batchReceivers[index][i]
                                ),
                                prevBal[index][i].add(amounts[index][i])
                            );
                    })
                );
            })
        );
    });

    it("#666 Unwrap ERC20 (deflationary)", async() => {
        /**
         * Authorized subjects:
         * Item holders
         * approved operator address
         * Functions used in the test:
         * Burn(address account, uint256 itemId, uint256 amount, bytes memory data)
         * burnBatch(address account, uint256[] calldata itemIds, uint256[] calldata amounts, bytes memory data)
         * Items used: Item10
         *
         * Unwrap FEG using the burn function.
         */

        if (!exec659) await test659();
        if (!exec660) await test660();
        if (!exec661) await test661();
        if (!exec662) await test662();

        var acc =
            itemsList[10].account[0] == utilities.voidEthereumAddress ?
            accounts[1] :
            itemsList[10].account[0];
        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [itemsList[10].tokenAddress, accounts[6]]
        );
        var bombAmounts = await bombToken.methods
            .balanceOf(wrapper.options.address)
            .call();
        var prevBal = await bombToken.methods.balanceOf(accounts[6]).call();
        var prevSupply = await wrapper.methods
            .totalSupply(itemsList[10].itemId)
            .call();

        var prevBombSupply = await bombToken.methods.totalSupply().call();

        var amountToBurn = await wrapper.methods
            .balanceOf(itemsList[10].account[0], itemsList[10].itemId)
            .call();
        var tx = await wrapper.methods
            .burn(acc, itemsList[10].itemId, amountToBurn, burn)
            .send(blockchainConnection.getSendingOptions({ from: acc }));

        var postBombSupply = await bombToken.methods.totalSupply().call();

        var burnAmount = prevBombSupply.sub(postBombSupply);

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
        var deflAmount = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] === web3.utils.sha3("Transfer(address,address,uint256)")
            )[1].data
        );
        assert.equal(
            prevSupply.sub(amountToBurn),
            await wrapper.methods.totalSupply(itemsList[10].itemId).call()
        );

        assert.equal(
            await bombToken.methods.balanceOf(accounts[6]).call(),
            prevBal.add(bombAmounts.sub(burnAmount))
        );

        await catchCall(wrapper.methods.setItemsCollection([0], [utilities.voidBytes32]).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), "Impossibru");

        var headerCollection = {
            host: accounts[1],
            name: "newCollection",
            symbol: "newC1",
            uri: "newUriC1",
        };

        await wrapper.methods.setHeader(headerCollection).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        headerCollection.host = wrapper.options.address;
        await itemProjection.assertCheckHeader(headerCollection, mainInterface.methods
            .collection(await wrapper.methods.collectionId().call())
            .call())

        var newItemsMetadata = [{
            host: accounts[1],
            name: "newItems1",
            symbol: "newI1",
            uri: "newUriI1",
        }, {
            host: accounts[2],
            name: "newItems2",
            symbol: "newI2",
            uri: "newUriI2",
        }, {
            host: accounts[3],
            name: "newItems3",
            symbol: "newI3",
            uri: "newUriI3",
        }, ];

        var itemToUpdate = [itemsList[8].itemId, itemsList[9].itemId, itemsList[10].itemId];

        await wrapper.methods.setItemsMetadata(itemToUpdate, newItemsMetadata).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
        await Promise.all(itemToUpdate.map(
            async(item, index) => {
                newItemsMetadata[index].host = utilities.voidEthereumAddress;
                await itemProjection.checkHeader(
                    (await mainInterface.methods
                        .item(item)
                        .call())["header"],
                    newItemsMetadata[index]
                )
            }
        ))
    });

    it("#667 Testing some different unwrap scenarios with different balances using the Interoperable burn operation: Scenario1", async() => {
        /**
        Authorized subjects:
        Item holders
        Functions used in the test:
        mint
        safeTransferFrom
        Burn
        Burn Interoperable
        Items used: Item 3, Item 5
        Scenario1:
        Wrap an ERC20
        Burn Interoperable 80%
        Unwrap 20% using the burn function

        Scenario2:
        wrap an ERC20
        Burn Interoperable 10 % -> new tot. supply = tot.supply original - burned amount.
        Unwrap 50% using the burn function.
        Transfer Interoperable 20%.
        Unwrap 20% using the burn function.
        20% remains
        */
        var prev = "1000000000000000000";
        const prevBalance = await osToken.methods.balanceOf(accounts[11]).call();
        await osToken.methods
            .transfer(accounts[11], prev)
            .send(blockchainConnection.getSendingOptions({ from: host }));
        assert.equal(
            await osToken.methods.balanceOf(accounts[11]).call(),
            prevBalance.add(prev)
        );

        var totalAmounts = [
            [prev]
        ];
        var receivers = [
            [accounts[11]]
        ];
        var tokenAddress = [osToken.options.address];

        await osToken.methods
            .approve(
                wrapper.options.address,
                await osToken.methods.balanceOf(accounts[11]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[11] }));

        var res = await wrapperResource.mintErc20(
            wrapper,
            tokenAddress,
            totalAmounts,
            receivers,
            accounts[11]
        );

        var osBalance = await osToken.methods
            .balanceOf(wrapper.options.address)
            .call();

        var itemIds = res["itemIds"];
        itemIds = [
            await wrapper.methods.itemIdOf(knowledgeBase.osTokenAddress).call(),
        ];

        await wrapperResource.assertDecimals(wrapper, itemIds);

        await wrapperResource.assertCheckErc20ItemBalance(
            wrapper,
            receivers,
            itemIds,
            totalAmounts
        );

        erc20Contract = await asInteroperableInterface(itemIds[0]);

        var prevSupply = await wrapper.methods.totalSupply(itemIds[0]).call();

        await erc20Contract.methods
            .burn(prev.mul(80).div(100))
            .send(blockchainConnection.getSendingOptions({ from: accounts[11] }));

        assert.equal(
            prevSupply.sub(prev.mul(80).div(100)),
            await wrapper.methods.totalSupply(itemIds[0]).call()
        );

        assert.equal(
            prev.mul(20).div(100),
            await erc20Contract.methods.balanceOf(accounts[11]).call()
        );

        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [osToken.options.address, accounts[6]]
        );

        prevSupply = await wrapper.methods.totalSupply(itemIds[0]).call();

        await wrapper.methods
            .burn(accounts[11], itemIds[0], prev.mul(20).div(100), burn)
            .send(blockchainConnection.getSendingOptions({ from: accounts[11] }));

        assert.equal(
            prevSupply.sub(prev.mul(20).div(100)),
            await wrapper.methods.totalSupply(itemIds[0]).call()
        );

        assert.equal(
            osBalance.sub(prev.mul(20).div(100)),
            await osToken.methods.balanceOf(wrapper.options.address).call()
        );

        assert.equal(
            "0",
            await erc20Contract.methods.balanceOf(accounts[11]).call()
        );
    });

    it("#667 Testing some different unwrap scenarios with different balances using the Interoperable burn operation: Scenario2", async() => {
        /**
        Authorized subjects:
        Item holders
        Functions used in the test:
        mint
        safeTransferFrom
        Burn
        Burn Interoperable
        Items used: Item 3, Item 5
        Scenario1:
        Wrap an ERC20
        Burn Interoperable 80%
        Unwrap 20% using the burn function

        Scenario2:
        wrap an ERC20
        Burn Interoperable 10 % -> new tot. supply = tot.supply original - burned amount.
        Unwrap 50% using the burn function.
        Transfer Interoperable 20%.
        Unwrap 20% using the burn function.
        20% remains
        */
        var prev = "1000000000000000000";
        var prevBalance = await osToken.methods.balanceOf(accounts[11]).call();
        await osToken.methods
            .transfer(accounts[11], "1000000000000000000")
            .send(blockchainConnection.getSendingOptions({ from: host }));
        assert.equal(
            await osToken.methods.balanceOf(accounts[11]).call(),
            prevBalance.add(prev)
        );

        var totalAmounts = [
            [prev]
        ];
        var receivers = [
            [accounts[11]]
        ];
        var tokenAddress = [osToken.options.address];
        var tokenName = ["Os"];

        await osToken.methods
            .approve(
                wrapper.options.address,
                await osToken.methods.balanceOf(accounts[11]).call()
            )
            .send(blockchainConnection.getSendingOptions({ from: accounts[11] }));

        var res = await wrapperResource.mintErc20(
            wrapper,
            tokenAddress,
            totalAmounts,
            receivers,
            accounts[11]
        );

        var osBalance = await osToken.methods
            .balanceOf(wrapper.options.address)
            .call();

        var itemIds = res["itemIds"];
        itemIds = [
            await wrapper.methods.itemIdOf(knowledgeBase.osTokenAddress).call(),
        ];

        erc20Contract = await asInteroperableInterface(itemIds[0]);

        assert.equal(
            await erc20Contract.methods.balanceOf(accounts[11]).call(),
            prev
        );
        var prevSupply = await wrapper.methods.totalSupply(itemIds[0]).call();

        await erc20Contract.methods
            .burn(prev.mul(10).div(100))
            .send(blockchainConnection.getSendingOptions({ from: accounts[11] }));

        assert.equal(
            prevSupply.sub(prev.mul(10).div(100)),
            await wrapper.methods.totalSupply(itemIds[0]).call()
        );

        assert.equal(
            prev.mul(90).div(100),
            await erc20Contract.methods.balanceOf(accounts[11]).call()
        );

        var burn = web3.eth.abi.encodeParameters(
            ["address", "address"], [osToken.options.address, accounts[6]]
        );

        prevSupply = await wrapper.methods.totalSupply(itemIds[0]).call();

        await wrapper.methods
            .burn(accounts[11], itemIds[0], prev.div(2), burn)
            .send(blockchainConnection.getSendingOptions({ from: accounts[11] }));

        assert.equal(
            prevSupply.sub(prev.div(2)),
            await wrapper.methods.totalSupply(itemIds[0]).call()
        );

        assert.equal(
            prev.mul(40).div(100),
            await erc20Contract.methods.balanceOf(accounts[11]).call()
        );

        await erc20Contract.methods
            .transfer(accounts[3], prev.mul(20).div(100))
            .send(blockchainConnection.getSendingOptions({ from: accounts[11] }));

        assert.equal(
            prev.mul(20).div(100),
            await erc20Contract.methods.balanceOf(accounts[3]).call()
        );

        prevSupply = await wrapper.methods.totalSupply(itemIds[0]).call();

        await wrapper.methods
            .burn(accounts[3], itemIds[0], prev.mul(20).div(100), burn)
            .send(blockchainConnection.getSendingOptions({ from: accounts[3] }));

        assert.equal(
            prevSupply.sub(prev.mul(20).div(100)),
            await wrapper.methods.totalSupply(itemIds[0]).call()
        );

        assert.equal(
            osBalance.sub(prev.mul(70).div(100)),
            await osToken.methods.balanceOf(wrapper.options.address).call()
        );

        assert.equal(
            "0",
            await erc20Contract.methods.balanceOf(accounts[3]).call()
        );
    });
});