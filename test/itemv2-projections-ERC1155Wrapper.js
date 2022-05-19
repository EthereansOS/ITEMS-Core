var itemsv2 = require("../resources/itemsv2");
var itemProjection = require("../resources/itemProjection");
var wrapperResource = require("../resources/wrapper");

describe("itemv2 projections ERC1155Wrapper", () => {
  var wrapper;
  var MainInterface;
  var mainInterface;
  var ItemInteroperableInterface;
  var itemInteroperableInterface;
  var itemInteroperableInterfaceAddress;
  var item1erc1155Address = "0x74EE68a33f6c9f113e22B3B77418B75f85d07D22";
  var item2erc1155Address = "0x915A22A152654714FcecA3f4704fCf6bd314624c";
  var item4erc1155Address = "0x76BE3b62873462d2142405439777e971754E8E77";
  var item5erc1155Address = "0xd07dc4262bcdbf85190c01c996b4c06a461d2430";
  var item1erc1155Id = "10";
  var item2erc1155Id = "1448357374059271822963346111639752691725470234835";
  var item3erc1155Id;
  var item4erc1155Id = "10";
  var item5erc1155Id = "17";
  var item6erc1155Id;
  var item1Holder1 = "0x072300626D4325197c65FAc4b0a19062d88A48E2";
  var item1Holder2 = "0x459C2029F74E89bA6D02688BC338580D89C7f84B";
  var item2Holder1 = "0x942eE44ef3A64e21Ce55EE8513B698e7058722F9";
  var item4Holder1 = "0x4897d38b0974051d8fa34364e37a5993f4a966a5";
  var item4Holder2 = "0xbad2e817Af781B6F1573d65409ddEF24d9656f8b";
  var item5Holder1 = "0xfb4c65f1dd92ae419f8d52e0ed3d94775476b900";
  var osHolderScenario = "0x07DE7A977fA1eCf1219F8773034880D2dFc4D3c4";
  var token1;
  var token2;
  var token4;
  var token5;
  var itemId1;
  var itemId2;
  var itemId3;
  var itemId4;
  var itemId5;
  var itemId6;
  var itemId7;
  var item3;
  var exec669 = false;
  var exec670 = false;

  var approvedHost = [];

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

  async function test669(){
    exec669 = true;

    var prevResult2Holder1 = await token2.methods
      .balanceOf(item2Holder1, item2erc1155Id)
      .call();

    await approveHost(item1Holder1);
    await approveHost(item1Holder2);
    await approveHost(item2Holder1);

    await wrapperResource.safeTransfer1155(
      item1Holder1,
      accounts[1],
      item1erc1155Id,
      "1",
      "0x",
      token1
    );

    await wrapperResource.safeTransfer1155(
      item1Holder2,
      accounts[1],
      item1erc1155Id,
      "1",
      "0x",
      token1
    );

    await wrapperResource.safeTransfer1155(
      item2Holder1,
      accounts[1],
      item2erc1155Id,
      prevResult2Holder1.div(2),
      "0x",
      token2
    );

    var wrongEncodeMint = web3.eth.abi.encodeParameters(
      ["uint256", "address"],
      [1, accounts[2]]
    );

    var encodeMint1 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [["2"], [accounts[1]]]
    );

    prevResult2Holder1 = prevResult2Holder1.div(2);

    var encodeMint2 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [
        [
          prevResult2Holder1.div(10).mul(1),
          prevResult2Holder1.div(10).mul(2),
          prevResult2Holder1.div(10).mul(1),
        ],
        [accounts[1], accounts[2], accounts[5]],
      ]
    );

    var encodeMint3 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [
        [
          prevResult2Holder1.div(10).mul(3),
          prevResult2Holder1.div(10).mul(1),
          prevResult2Holder1.div(10).mul(2),
        ],
        [accounts[1], accounts[2], accounts[6]],
      ]
    );

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[1]]]
    );

    await catchCall(
      token1.methods
        .safeTransferFrom(
          accounts[1],
          wrapper.options.address,
          item1erc1155Id,
          1,
          wrongEncodeMint
        )
        .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "ERC1155: transfer to non ERC1155Receiver implementer"
    );

    itemId1 = await wrapperResource.mintItems1155(
      token1,
      accounts[1],
      wrapper.options.address,
      item1erc1155Id,
      2,
      encodeMint1,
      itemId1,
      wrapper,
      [accounts[1]],
      ["2000000000000000000"]
    );

    await catchCall(blockchainCall(mainInterface.methods.safeTransferFrom, accounts[1], wrapper.options.address, itemId1, utilities.numberToString(1e18), "0x", {from : accounts[1]}), "invalid");
    await catchCall(blockchainCall(wrapper.methods.safeTransferFrom, accounts[1], wrapper.options.address, itemId1, utilities.numberToString(1e18), "0x", {from : accounts[1]}), "invalid");

    itemId2 = await wrapperResource.mintItems1155(
      token2,
      accounts[1],
      wrapper.options.address,
      item2erc1155Id,
      prevResult2Holder1
        .div(10)
        .mul(1)
        .add(prevResult2Holder1.div(10).mul(2))
        .add(prevResult2Holder1.div(10).mul(1)),
      encodeMint2,
      itemId2,
      wrapper,
      [accounts[1], accounts[2], accounts[5]],
      [
        prevResult2Holder1.div(10).mul(1),
        prevResult2Holder1.div(10).mul(2),
        prevResult2Holder1.div(10).mul(1),
      ]
    );

    itemId2 = await wrapperResource.mintItems1155(
      token2,
      accounts[1],
      wrapper.options.address,
      item2erc1155Id,
      prevResult2Holder1
        .div(10)
        .mul(3)
        .add(prevResult2Holder1.div(10).mul(1))
        .add(prevResult2Holder1.div(10).mul(2)),
      encodeMint3,
      itemId2,
      wrapper,
      [accounts[1], accounts[2], accounts[6]],
      [
        prevResult2Holder1.div(10).mul(3),
        prevResult2Holder1.div(10).mul(1),
        prevResult2Holder1.div(10).mul(2),
      ]
    );

    itemId3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      item3erc1155Id[0],
      1,
      encodeMint4,
      itemId3,
      wrapper,
      [accounts[1]],
      ["1000000000000000000"]
    );

    await wrapperResource.safeTransfer1155(
      accounts[1],
      accounts[2],
      itemId1,
      "600000000000000000",
      "0x",
      wrapper
    );

    await wrapperResource.safeTransfer1155(
      accounts[1],
      accounts[4],
      itemId1,
      "400000000000000000",
      "0x",
      wrapper
    );

    await wrapperResource.safeTransfer1155(
      accounts[1],
      accounts[2],
      itemId3,
      "200000000000000000",
      "0x",
      wrapper
    );

  };

  async function test670(){
    exec670 = true;
    var prevResult2Holder1 = await token2.methods
      .balanceOf(item2Holder1, item2erc1155Id)
      .call();

    await approveHost(item2Holder1);
    await approveHost(item4Holder1);
    await approveHost(item4Holder2);
    await approveHost(item5Holder1);

    await wrapperResource.safeTransfer1155(
      item2Holder1,
      accounts[2],
      item2erc1155Id,
      prevResult2Holder1,
      "0x",
      token2
    );

    prevResult2Holder1 = prevResult2Holder1.div(2);

    await wrapperResource.safeTransfer1155(
      item4Holder1,
      accounts[2],
      item4erc1155Id,
      "2",
      "0x",
      token4
    );

    await wrapperResource.safeTransfer1155(
      item4Holder2,
      accounts[2],
      item4erc1155Id,
      "1",
      "0x",
      token4
    );

    await wrapperResource.safeTransfer1155(
      item5Holder1,
      accounts[2],
      item5erc1155Id,
      "3",
      "0x",
      token5
    );

    var encodeMint2 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [
        [
          prevResult2Holder1.div(3),
          prevResult2Holder1.div(3),
          prevResult2Holder1.div(3),
        ],
        [accounts[3], accounts[1], accounts[2]],
      ]
    );

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [["3"], [accounts[3]]]
    );

    var encodeMint5 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [["3"], [accounts[3]]]
    );

    var encodeMint6 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [["1"], [accounts[3]]]
    );

    itemId2 = await wrapperResource.mintItems1155(
      token2,
      accounts[2],
      wrapper.options.address,
      item2erc1155Id,
      prevResult2Holder1
        .div(3)
        .add(prevResult2Holder1.div(3))
        .add(prevResult2Holder1.div(3)),
      encodeMint2,
      itemId2,
      wrapper,
      [accounts[3], accounts[1], accounts[2]],
      [
        prevResult2Holder1.div(3),
        prevResult2Holder1.div(3),
        prevResult2Holder1.div(3),
      ]
    );

    itemId4 = await wrapperResource.mintItems1155(
      token4,
      accounts[2],
      wrapper.options.address,
      item4erc1155Id,
      3,
      encodeMint4,
      itemId4,
      wrapper,
      [accounts[3]],
      ["3000000000000000000"]
    );
    itemId5 = await wrapperResource.mintItems1155(
      token5,
      accounts[2],
      wrapper.options.address,
      item5erc1155Id,
      3,
      encodeMint5,
      itemId5,
      wrapper,
      [accounts[3]],
      ["3000000000000000000"]
    );
    itemId6 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      item6erc1155Id[0],
      1,
      encodeMint6,
      itemId6,
      wrapper,
      [accounts[3]],
      ["1000000000000000000"]
    );

    await wrapperResource.safeBatchTransfer1155(
      accounts[3],
      accounts[2],
      [itemId4, itemId5],
      ["400000000000000000", "700000000000000000"],
      "0x",
      wrapper
    );

    await wrapperResource.safeBatchTransfer1155(
      accounts[3],
      accounts[4],
      [itemId4],
      ["400000000000000000"],
      "0x",
      wrapper
    );

    await wrapperResource.safeBatchTransfer1155(
      accounts[3],
      accounts[6],
      [itemId5],
      ["300000000000000000"],
      "0x",
      wrapper
    );

    await wrapperResource.safeBatchTransfer1155(
      accounts[3],
      accounts[7],
      [itemId6],
      ["200000000000000000"],
      "0x",
      wrapper
    );

  };

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

    var NFTDynamicUriRenderer = await compile('util/NFTDynamicUriRenderer');
    var nftDynamicUriRenderer = await new web3.eth.Contract(NFTDynamicUriRenderer.abi).deploy({data : NFTDynamicUriRenderer.bin, arguments : [utilities.voidEthereumAddress, "myUri"]}).send(blockchainConnection.getSendingOptions());

    var uri = web3.eth.abi.encodeParameters(["address", "bytes"], [nftDynamicUriRenderer.options.address, "0x"]);

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
      ],
      [
        utilities.voidBytes32,
        await itemsv2.convertHeader(headerCollection),
        items,
        utilities.voidBytes32,
      ]
    );

    mainInterface = await itemsv2.getMainInterface();

    deployParam = abi.encode(["address", "bytes"], [accounts[1], deployParam]);

    var ERC1155Wrapper = await compile("projection/ERC1155/ERC1155Wrapper");
    var wrapperData = await new web3.eth.Contract(ERC1155Wrapper.abi)
    .deploy({ data: ERC1155Wrapper.bin, arguments: ["0x"] }).encodeABI();

    var data = await itemsv2.createCollection(headerCollection.host, items, wrapperData, "0x", headerCollection);

    wrapper = new web3.eth.Contract(ERC1155Wrapper.abi, data.projection.options.address);

    console.log("Wrapper Uri", await wrapper.methods.uri().call());
    assert.equal(await wrapper.methods.uri().call(), await mainInterface.methods.collectionUri(await wrapper.methods.collectionId().call()).call());

    var ZeroDecimals = await compile("../resources/ERC1155ZeroDecimals");
    wrapperData = await new web3.eth.Contract(ZeroDecimals.abi)
      .deploy({ data: ZeroDecimals.bin, arguments: ["0x"] })
      .encodeABI();

    data = await itemsv2.createCollection(headerCollection.host, items, wrapperData, "0x", headerCollection);

    zeroDecimals = new web3.eth.Contract(ZeroDecimals.abi, data.projection.options.address);

    token1 = new web3.eth.Contract(
      knowledgeBase.IERC1155ABI,
      item1erc1155Address
    );
    token2 = new web3.eth.Contract(
      knowledgeBase.IERC1155ABI,
      item2erc1155Address
    );
    token4 = new web3.eth.Contract(
      knowledgeBase.IERC1155ABI,
      item4erc1155Address
    );
    token5 = new web3.eth.Contract(
      knowledgeBase.IERC1155ABI,
      item5erc1155Address
    );

    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    item3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    item6erc1155Id = await itemProjection.getItemIdFromLog(tx);
  });

  it("#669 Wrap ERC1155 using the onERC1155Received", async () => {
    /**
        Authorized subjects:
        Item holders
        approved operator address
        Functions used in the test:
        onERC1155Received
        onERC1155BatchReceived
        Items used:
        Must fail: an ERC1155 with decimals different from 0 (not Item) cannot be wrapped.
        Must fail: a wrapping operation using the onERC1155Received without passing an array of values, cannot be performed.
        Wrap Item1 using the safeTransferFrom (onERC1155Received).
        Wrap Item2 using the safeTransferFrom (onERC1155Received).
        Wrap Item2 using the safeTransferFrom (onERC1155Received).
        Wrap Item3 using the safeTransferFrom (onERC1155Received).
        */
      await test669();
  });

  it("#670 Wrap ERC1155 using the onERC1155BatchReceived", async () => {
    await test670();
  });

  it("#671 Unwrap single using Burn", async () => {
    if(!exec669) await test669();
    var prevBal = await token2.methods
      .balanceOf(accounts[1], item2erc1155Id)
      .call();

    var burn = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [token1.options.address, item1erc1155Id, accounts[5], "0x"]
    );

    var burnCatchCall = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [token2.options.address, item1erc1155Id, accounts[5], "0x"]
    );

    var burn2 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        token2.options.address,
        item2erc1155Id,
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [zeroDecimals.options.address, item3erc1155Id[0], accounts[5], "0x"]
    );

    await catchCall(
      wrapper.methods
      .burn(accounts[1], itemId1, "1000000000000000000", burnCatchCall)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "token"
    );

    await wrapperResource.burn1155(
      accounts[1],
      accounts[1],
      itemId3,
      "800000000000000000",
      burn3,
      wrapper
    );

    await wrapperResource.burn1155(
      accounts[1],
      accounts[1],
      itemId1,
      "1000000000000000000",
      burn,
      wrapper
    );

    var amountBurn2 = (
      await wrapper.methods.balanceOf(accounts[1], itemId2).call()
    ).div(3);

    await catchCall(
      wrapper.methods
      .burn(utilities.voidEthereumAddress, itemId2, amountBurn2, burn2)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] })),
      "required account");

    await wrapperResource.burn1155(
      accounts[1],
      accounts[1],
      itemId2,
      amountBurn2,
      burn2,
      wrapper
    );
  });

  it("#672 Unwrap batch using burnBatch", async () => {
    if(!exec669) await test669();
    if(!exec670) await test670();
    var prevAmount2 = await wrapper.methods
      .balanceOf(accounts[3], itemId2)
      .call();
    var amounts = [
      prevAmount2,
      "2200000000000000000",
      "2000000000000000000",
      "800000000000000000",
    ];
    var itemId = [itemId2, itemId4, itemId5, itemId6];
    var tokenAddress = [
      item2erc1155Address,
      item4erc1155Address,
      item5erc1155Address,
      zeroDecimals.options.address,
    ];
    var tokenId = [
      item2erc1155Id,
      item4erc1155Id,
      item5erc1155Id,
      item6erc1155Id[0],
    ];
    var receiver = [
      accounts[5],
      accounts[6],
      utilities.voidEthereumAddress,
      utilities.voidEthereumAddress,
    ];
    var receiversCheck = [accounts[5], accounts[6], accounts[9], accounts[9]];
    var tokenContract = [token2, token4, token5, mainInterface];

    var burn = [];

    await Promise.all(
      tokenAddress.map(async (item, index) => {
        burn.push(
          web3.eth.abi.encodeParameters(
            ["address", "uint256", "address", "bytes"],
            [tokenAddress[index], tokenId[index], receiver[index], "0x"]
          )
        );
      })
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [burn]);

    await catchCall(wrapper.methods
      .safeBatchTransferFrom(
        utilities.voidEthereumAddress,
        accounts[9],
        itemId,
        amounts,
        "0x"
      )
    .send(blockchainConnection.getSendingOptions({ from: accounts[3] })),
    "required from");

    await catchCall(wrapper.methods
      .safeBatchTransferFrom(
        accounts[3],
        utilities.voidEthereumAddress,
        itemId,
        amounts,
        "0x"
      )
    .send(blockchainConnection.getSendingOptions({ from: accounts[3] })),
    "required to");

    await catchCall(wrapper.methods
      .safeBatchTransferFrom(
        utilities.voidEthereumAddress,
        utilities.voidEthereumAddress,
        itemId,
        amounts,
        "0x"
      )
    .send(blockchainConnection.getSendingOptions({ from: accounts[3] })),
    "required from");

    await wrapperResource.safeBatchTransfer1155(
      accounts[3],
      accounts[9],
      itemId,
      amounts,
      "0x",
      wrapper
    );

    await catchCall(
      wrapper.methods
        .burnBatch(accounts[9], itemId, amounts, datas)
        .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
      "amount"
    );

    amounts = [
      prevAmount2,
      "2000000000000000000",
      "2000000000000000000",
      "800000000000000000",
    ];

    await catchCall(
      wrapper.methods
        .burnBatch(utilities.voidEthereumAddress, itemId, amounts, datas)
        .send(blockchainConnection.getSendingOptions({ from: accounts[9] })),
      "required account"
    );

    await wrapper.methods
      .burnBatch(accounts[9], itemId, amounts, datas)
      .send(blockchainConnection.getSendingOptions({ from: accounts[9] }));

    var expectedBalance = [prevAmount2, "2", "2", "1000000000000000000"];
    await Promise.all(
      tokenContract.map(async (contract, index) => {
        assert.equal(
          await contract.methods
            .balanceOf(receiversCheck[index], tokenId[index])
            .call(),
          expectedBalance[index]
        );
      })
    );

    await catchCall(wrapper.methods.setItemsCollection([0],[utilities.voidBytes32]).send(blockchainConnection.getSendingOptions({ from: accounts[1] })), "Impossibru");

    var headerCollection = {
      host: accounts[1],
      name: "newCollection",
      symbol: "newC1",
      uri: "newUriC1",
    };

    await catchCall(wrapper.methods.setHeader(headerCollection).send(blockchainConnection.getSendingOptions({ from: accounts[0] })), "unauthorized");
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
      },{
        host: accounts[2],
        name: "newItems2",
        symbol: "newI2",
        uri: "newUriI2",
      },{
        host: accounts[3],
        name: "newItems3",
        symbol: "newI3",
        uri: "newUriI3",
      },];

    var itemToUpdate = [itemId[0], itemId[1], itemId[2]];

    await catchCall(wrapper.methods.setItemsMetadata(itemToUpdate, newItemsMetadata).send(blockchainConnection.getSendingOptions({ from: accounts[0] })), "unauthorized");
    await wrapper.methods.setItemsMetadata(itemToUpdate, newItemsMetadata).send(blockchainConnection.getSendingOptions({ from: accounts[1] }));
    await Promise.all(itemToUpdate.map(
      async (item, index) => {
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

  it("#673 Scenario 1 Testing some different unwrap scenarios with different balances", async () => {
    var prevResult2Holder1 = await token2.methods
      .balanceOf(osHolderScenario, item2erc1155Id)
      .call();

    await approveHost(osHolderScenario);

    await wrapperResource.safeTransfer1155(
      osHolderScenario,
      accounts[5],
      item2erc1155Id,
      prevResult2Holder1,
      "0x",
      token2
    );

    var encodeMint2 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[prevResult2Holder1], [accounts[5]]]
    );

    itemId2 = await wrapperResource.mintItems1155(
      token2,
      accounts[5],
      wrapper.options.address,
      item2erc1155Id,
      prevResult2Holder1,
      encodeMint2,
      itemId2,
      wrapper,
      [accounts[5]],
      [prevResult2Holder1]
    );

    await catchCall(
      wrapper.methods
      .safeTransferFrom(
        utilities.voidEthereumAddress,
        accounts[5],
        itemId2,
        prevResult2Holder1.div(3),
        "0x",
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
    "required from");

    await catchCall(
      wrapper.methods
      .safeTransferFrom(
        utilities.voidEthereumAddress,
        utilities.voidEthereumAddress,
        itemId2,
        prevResult2Holder1.div(3),
        "0x",
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
    "required from");

    await catchCall(
      wrapper.methods
      .safeTransferFrom(
        accounts[5],
        utilities.voidEthereumAddress,
        itemId2,
        prevResult2Holder1.div(3),
        "0x",
      )
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
    "required to");

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      itemId2,
      prevResult2Holder1.div(3),
      "0x",
      wrapper
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[3],
      itemId2,
      prevResult2Holder1.div(5),
      "0x",
      wrapper
    );

    var burn2 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        token2.options.address,
        item2erc1155Id,
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await wrapperResource.burn1155(
      accounts[4],
      accounts[4],
      itemId2,
      prevResult2Holder1.div(3),
      burn2,
      wrapper
    );

    await wrapperResource.burn1155(
      accounts[3],
      accounts[3],
      itemId2,
      prevResult2Holder1.div(5),
      burn2,
      wrapper
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[4], itemId2).call(),
      "0"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[3], itemId2).call(),
      "0"
    );
  });

  it("#673 Scenario 2 Testing some different unwrap scenarios with different balances", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    scenarioItem3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3,
      wrapper,
      [accounts[5]],
      ["1000000000000000000"]
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      item3,
      "400000000000000000",
      "0x",
      wrapper
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      item3,
      "600000000000000000",
      burn3,
      wrapper
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "0"
    );

    item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3,
      wrapper,
      [accounts[5]],
      ["600000000000000000"]
    );
  });

  it("#673 Scenario 3 Testing some different unwrap scenarios with different balances", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenario3Item3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    var item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenario3Item3erc1155Id[0],
      1,
      encodeMint4,
      item3,
      wrapper,
      [accounts[5]],
      ["1000000000000000000"]
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenario3Item3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenario3Item3erc1155Id[0])
        .call(),
      "0"
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      item3,
      "400000000000000000",
      "0x",
      wrapper
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenario3Item3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[5], item3, "500000000000000000", burn3)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "amount"
    );
  });

  it("#673 Scenario 4 Testing some different unwrap scenarios with different balances", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    var item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3,
      wrapper,
      [accounts[5]],
      ["1000000000000000000"]
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      item3,
      "100000000000000000",
      "0x",
      wrapper
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[6],
      item3,
      "190000000000000000",
      "0x",
      wrapper
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[7],
      item3,
      "200000000000000000",
      "0x",
      wrapper
    );

    var burnCatchCall = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[4], item3, "100000000000000000", burnCatchCall)
        .send(blockchainConnection.getSendingOptions({ from: accounts[4] })),
      "amount"
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[6], item3, "190000000000000000", burnCatchCall)
        .send(blockchainConnection.getSendingOptions({ from: accounts[6] })),
      "amount"
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[7], item3, "200000000000000000", burnCatchCall)
        .send(blockchainConnection.getSendingOptions({ from: accounts[7] })),
      "amount"
    );

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      item3,
      "510000000000000000",
      burn3,
      wrapper
    );


    item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3,
      wrapper,
      [accounts[5]],
      ["510000000000000000"]
    );
  });

  it("#673 Scenario 5 Testing some different unwrap scenarios with different balances", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["1000000000000000000"]
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "1000000000000000000"
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      itemId7,
      "400000000000000000",
      "0x",
      wrapper
    );

    var burnCatchCall = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[4], itemId7, "400000000000000000", burnCatchCall)
        .send(blockchainConnection.getSendingOptions({ from: accounts[4] })),
      "amount"
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );


    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "600000000000000000",
      burn7,
      wrapper
    );


    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["600000000000000000"]
    );
  });

  it("#673 Scenario 6 Testing some different unwrap scenarios with different balances", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["2"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[2], [utilities.voidEthereumAddress]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      2,
      encodeMint,
      itemId7,
      wrapper,
      [utilities.voidEthereumAddress],
      ["2000000000000000000"]
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      itemId7,
      "400000000000000000",
      "0x",
      wrapper
    );

    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: scenarioItem7erc1155Id[0],
        accounts: [accounts[4]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[4]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[4],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[4]],
      ["1000000000000000000"]
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[5], itemId7, "600000000000000000", burn7)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "amount"
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "1000000000000000000",
      burn7,
      wrapper
    );


    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "1"
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[4]],
      ["1000000000000000000"]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[4], itemId7, "1400000000000000000", burn7)
        .send(blockchainConnection.getSendingOptions({ from: accounts[4] })),
      "amount"
    );

    await wrapperResource.burn1155(
      accounts[4],
      accounts[4],
      itemId7,
      "1000000000000000000",
      burn7,
      wrapper
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[4], scenarioItem7erc1155Id[0])
        .call(),
      "1"
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[4]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[4],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[4]],
      ["1000000000000000000"]
    );
  });

  it("#673 Scenario 7 Testing some different unwrap scenarios with different balances", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["6"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[6], [accounts[5]]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      6,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["6000000000000000000"]
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      itemId7,
      "3500000000000000000",
      "0x",
      wrapper
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[5], itemId7, "2500000000000000000", burn7)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "amount"
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[4], itemId7, "3500000000000000000", burn7)
        .send(blockchainConnection.getSendingOptions({ from: accounts[4] })),
      "amount"
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "2000000000000000000",
      burn7,
      wrapper
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "2"
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[2], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      2,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["2000000000000000000"]
    );
  });

  it("#673 Scenario 8 Testing some different unwrap scenarios with different balances", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [utilities.voidEthereumAddress]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [utilities.voidEthereumAddress],
      ["1000000000000000000"]
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      itemId7,
      "400000000000000000",
      "0x",
      wrapper
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "600000000000000000",
      burn7,
      wrapper
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["600000000000000000"]
    );

    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: scenarioItem7erc1155Id[0],
        accounts: [accounts[5]],
        amounts: ["3"],
      },
    ];

    var amountBatch = [1, 2];

    var encodeMint = await Promise.all(
      amountBatch.map(async (amount, index) =>
        web3.eth.abi.encodeParameters(
          ["uint256[]", "address[]"],
          [[amount], [accounts[5]]]
        )
      )
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [encodeMint]);


    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    itemId7 = await wrapperResource.mintBatchItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      [scenarioItem7erc1155Id[0], scenarioItem7erc1155Id[0]],
      [1, 2],
      datas,
      itemId7
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[5], itemId7, "600000000000000000", burn7)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "amount"
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "3000000000000000000",
      burn7,
      wrapper
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "3"
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[3], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      3,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["3000000000000000000"]
    );
  });

  it("#673 Scenario 9 Testing some different unwrap scenarios with different balances", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [utilities.voidEthereumAddress]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [utilities.voidEthereumAddress],
      ["1000000000000000000"]
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      itemId7,
      "400000000000000000",
      "0x",
      wrapper
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "600000000000000000",
      burn7,
      wrapper
    );

    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: scenarioItem7erc1155Id[0],
        accounts: [accounts[5]],
        amounts: ["3"],
      },
    ];

    var amountBatch = [1, 2];

    var encodeMint = await Promise.all(
      amountBatch.map(async (amount, index) =>
        web3.eth.abi.encodeParameters(
          ["uint256[]", "address[]"],
          [[amount], [accounts[5]]]
        )
      )
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [encodeMint]);


    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));


    itemId7 = await wrapperResource.mintBatchItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      [scenarioItem7erc1155Id[0], scenarioItem7erc1155Id[0]],
      [1, 2],
      datas,
      itemId7
    );

    console.log("Marco Total Supply:", await wrapper.methods.totalSupply(itemId7).call());

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["1000000000000000000"]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[5], itemId7, "600000000000000000", burn7)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "amount"
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "3000000000000000000",
      burn7,
      wrapper
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "3"
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "600000000000000000",
      burn7,
      wrapper
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[3], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      3,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["3000000000000000000"]
    );
  });

  it("#673 Scenario 10 Testing some different unwrap scenarios with different balances", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [utilities.voidEthereumAddress]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [utilities.voidEthereumAddress],
      ["1000000000000000000"]
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    await wrapperResource.safeTransfer1155(
      accounts[5],
      accounts[4],
      itemId7,
      "400000000000000000",
      "0x",
      wrapper
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "600000000000000000",
      burn7,
      wrapper
    );

    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: scenarioItem7erc1155Id[0],
        accounts: [accounts[5]],
        amounts: ["3"],
      },
    ];

    var amountBatch = [2, 1];

    var encodeMint = await Promise.all(
      amountBatch.map(async (amount, index) =>
        web3.eth.abi.encodeParameters(
          ["uint256[]", "address[]"],
          [[amount], [accounts[5]]]
        )
      )
    );

    var datas = web3.eth.abi.encodeParameters(["bytes[]"], [encodeMint]);

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));


    itemId7 = await wrapperResource.mintBatchItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      [scenarioItem7erc1155Id[0], scenarioItem7erc1155Id[0]],
      [2, 1],
      datas,
      itemId7
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["1000000000000000000"]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[5], itemId7, "600000000000000000", burn7)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "amount"
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "3000000000000000000",
      burn7,
      wrapper
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "3"
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[3], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      3,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["3000000000000000000"]
    );
  });

  it("#674 scenario 1 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    var item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3,
      wrapper,
      [accounts[5]],
      ["1000000000000000000"]
    );

    var erc20Contract = await asInteroperableInterface(item3);

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );

    await erc20Contract.methods
      .transferFrom(accounts[5], accounts[4], "400000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      item3,
      "600000000000000000",
      burn3,
      wrapper
    );

    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], item3).call(),
      "0"
    );

    item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3,
      wrapper,
      [accounts[5]],
      ["600000000000000000"]
    );
  });

  it("#674 scenario 2 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem3 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[1]],
        amounts: ["1"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem3)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem3erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint4 = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    var item3 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[1],
      wrapper.options.address,
      scenarioItem3erc1155Id[0],
      1,
      encodeMint4,
      item3,
      wrapper,
      [accounts[5]],
      ["1000000000000000000"]
    );

    var erc20Contract = await asInteroperableInterface(item3);

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[1], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );
    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem3erc1155Id[0])
        .call(),
      "0"
    );

    await erc20Contract.methods
      .transferFrom(accounts[5], accounts[4], "500000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    var burn3 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem3erc1155Id[0],
        accounts[5],
        "0x",
      ]
    );

    await catchCall(
      wrapper.methods
        .burn(accounts[5], item3, "500000000000000000", burn3)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "amount"
    );
  });

  it("#674 scenario 3 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["3"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[3], [accounts[5]]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      3,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["3000000000000000000"]
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    var erc20Contract = await asInteroperableInterface(itemId7);

    await erc20Contract.methods.burn("1000000000000000000").send(
      blockchainConnection.getSendingOptions({
        from: accounts[5],
      })
    );

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );


    await catchCall(
      wrapper.methods
        .burn(accounts[5], itemId7, "4000000000000000000", burn7)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "insuff"
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "2000000000000000000",
      burn7,
      wrapper
    );


    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "2"
    );
    assert.equal(
      await wrapper.methods.balanceOf(accounts[5], itemId7).call(),
      "0"
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [accounts[5]]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["1000000000000000000"]
    );
  });

  it("#674 scenario 4 Testing some different unwrap and rewrap scenarios with different balances using the Interoperable burn operation", async () => {
    var CreateItem7 = [
      {
        header: {
          host: accounts[1],
          name: "Item1",
          symbol: "I1",
          uri: "uriItem1",
        },
        collectionId: await zeroDecimals.methods.collectionId().call(),
        id: 0,
        accounts: [accounts[5]],
        amounts: ["3"],
      },
    ];

    var tx = await zeroDecimals.methods
      .mintItems(CreateItem7)
      .send(blockchainConnection.getSendingOptions({ from: accounts[1] }));

    var scenarioItem7erc1155Id = await itemProjection.getItemIdFromLog(tx);

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[3], [accounts[5]]]
    );

    var itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[5],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      3,
      encodeMint,
      itemId7,
      wrapper,
      [accounts[5]],
      ["3000000000000000000"]
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "0"
    );

    var erc20Contract = await asInteroperableInterface(itemId7);

    await erc20Contract.methods
      .transferFrom(accounts[5], accounts[4], "1800000000000000000")
      .send(blockchainConnection.getSendingOptions({ from: accounts[5] }));

    var burn7 = web3.eth.abi.encodeParameters(
      ["address", "uint256", "address", "bytes"],
      [
        zeroDecimals.options.address,
        scenarioItem7erc1155Id[0],
        utilities.voidEthereumAddress,
        "0x",
      ]
    );


    await catchCall(
      wrapper.methods
        .burn(accounts[5], itemId7, "1200000000000000000", burn7)
        .send(blockchainConnection.getSendingOptions({ from: accounts[5] })),
      "amount"
    );

    await wrapperResource.burn1155(
      accounts[5],
      accounts[5],
      itemId7,
      "1000000000000000000",
      burn7,
      wrapper
    );

    await wrapperResource.burn1155(
      accounts[4],
      accounts[4],
      itemId7,
      "1000000000000000000",
      burn7,
      wrapper
    );


    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[5], scenarioItem7erc1155Id[0])
        .call(),
      "1"
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[4], scenarioItem7erc1155Id[0])
        .call(),
      "1"
    );

    await wrapperResource.burn1155(
      accounts[4],
      accounts[4],
      itemId7,
      "600000000000000000",
      burn7,
      wrapper
    );

    assert.equal(
      await zeroDecimals.methods
        .balanceOf(accounts[4], scenarioItem7erc1155Id[0])
        .call(),
      "2"
    );

    var encodeMint = web3.eth.abi.encodeParameters(
      ["uint256[]", "address[]"],
      [[1], [utilities.voidEthereumAddress]]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[4],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [utilities.voidEthereumAddress],
      ["600000000000000000"]
    );

    itemId7 = await wrapperResource.mintItems1155(
      zeroDecimals,
      accounts[4],
      wrapper.options.address,
      scenarioItem7erc1155Id[0],
      1,
      encodeMint,
      itemId7,
      wrapper,
      [utilities.voidEthereumAddress],
      ["1000000000000000000"]
    );
  });
});
