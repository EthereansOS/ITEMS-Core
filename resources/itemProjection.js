var compile = require("../util/compile");
var itemsv2 = require("../resources/itemsv2");
var blockchainConnection = require("../util/blockchainConnection");
const { isCommunityResourcable } = require("@ethersproject/providers");
const utilities = require("../util/utilities");
var mainInterfaceAddress = "0x915A22A152654714FcecA3f4704fCf6bd314624c";
var mainInterface;
var noneBalance = [];

async function createNoneBal(address, items) {
  for (let i = 0; i < items.length; i++) {
    var items = { balances: [], totalSupplies: [] };
    items.balances.push(Array(address[i].length).fill(0));
    items.totalSupplies.push(Array(1).fill(0));
    noneBalance.push(items);
    return noneBalance;
  }
}

async function execFunct(funct) {
  var tx;
  try {
    if (funct.send) {
      tx = await funct.send(blockchainConnection.getSendingOptions());
    } else if (funct.then) {
      tx = await funct;
    } else {
      var f = funct();
      tx = f.then && (await f());
    }
    return tx;
  } catch (e) {
    console.error(e);
  }
}

async function getItemIdFromLog(transaction) {
  var logs = (await web3.eth.getTransactionReceipt(transaction.transactionHash))
    .logs;
  return logs
    .filter(
      (it) =>
        it.topics[0] ===
        web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
    )
    .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));
}

async function assertTransferBalance(
  fromAddress,
  toAddress,
  itemids,
  transferAmount,
  checkBalFrom,
  checkBalTo,
  native
) {
  var expectedBalanceFrom = await Promise.all(
    checkBalFrom["balances"].map(async (item, index) => {
      return await Promise.all(
        item.map((it, i) => {
          return it.sub(transferAmount[index]);
        })
      );
    })
  );
  var expectedBalanceTo = await Promise.all(
    checkBalTo["balances"].map(async (item, index) => {
      return await Promise.all(
        item.map((it, i) => {
          return it.add(transferAmount[index]);
        })
      );
    })
  );

  var expectedTotalSupplies = checkBalFrom["totalSupplies"];

  await itemsv2.checkBalances(
    fromAddress,
    itemids,
    expectedBalanceFrom,
    expectedTotalSupplies,
    native
  );
  await itemsv2.checkBalances(
    toAddress,
    itemids,
    expectedBalanceTo,
    expectedTotalSupplies,
    native
  );
}

async function assertBurnBalance(checkBal, burnAmount, burnAddress, idItems, native) {
  var expectedBalance = await Promise.all(
    checkBal["balances"].map(async (item, index) => {
      return await Promise.all(
        item.map((it, i) => {
          return it.sub(burnAmount[index][i]);
        })
      );
    })
  );

  var expectedSupply = await Promise.all(
    checkBal["totalSupplies"].map(async (item, index) => {
      return await Promise.all(
        item.map((it, i) => {
          return it.sub(burnAmount[index][i]);
        })
      );
    })
  );

  await Promise.all(
    idItems.map(async (item, index) => {
      await itemsv2.checkBalances(
        burnAddress[index],
        [idItems[index]],
        expectedBalance[index],
        expectedSupply[index],
        native
      );
    })
  );
}

async function assertCheckBalanceSupply(
  funct,
  createItem,
  native
) {
  var MainInterface = await compile("model/IItemMainInterface");
  mainInterface = new web3.eth.Contract(
    MainInterface.abi,
    mainInterfaceAddress
  );
  var idItems = createItem.map((it) => it.id);
  var amounts = createItem.map((it) => it.amounts);
  var accounts = createItem.map((it) => it.accounts);

  createNoneBal(accounts, idItems);
  var checkBal =
    idItems[0] == 0
      ? noneBalance
      : await Promise.all(
          accounts.map(async (it, i) => {
            return await itemsv2.checkBalances(
              it,
              Array(it.length).fill(idItems[i]),
              native
            );
          })
        );
  var transaction = await execFunct(funct);
  if (idItems == 0) {
    idItems = await getItemIdFromLog(transaction);
  }

  var expectedBalance = []

  checkBal.map((it, i) => {
    it["balances"].map((item, index) => {
      item.map((element, indexEl) => {
        if(element != null && typeof(element) != 'undefined' && typeof(amounts[index][indexEl]) != 'undefined'){
            expectedBalance.push(element.add(amounts[index][indexEl]));
        }
      });
    });
  });

  var expectedSupply = checkBal.map((it, i) => {
    return it["totalSupplies"].map((item, index) => {
      return item.map((element, indexEl) => {
        if(element != null && element !== undefined){
          return i < amounts.length ? element.add(amounts[i].reduce((total, arg) => total.add(arg), 0)) : element;
        }
      });
    });
  });

  await Promise.all(
    idItems.map(async (event, index) => {
      await itemsv2.checkBalances(
        accounts[index],
        Array(accounts[index].length).fill(event),
        expectedBalance[index],
        expectedSupply[0][index],
        native
      );
    })
  );

  return transaction;
}

async function assertCheckBalance(checkBal, CreateItem, itemids, native) {
  if (!Array.isArray(itemids)) {
    itemids = [itemids];
  }
  var expectedBalance = await Promise.all(
    checkBal.map(async (bal, index) => {
      return await Promise.all(
        bal["balances"].map(async (b, i) => {
          return index < CreateItem.length ? b[0].add(CreateItem[index]["amounts"][i]) : b[0];
        })
      );
    })
  );

  var expectedSupply = await Promise.all(
    checkBal.map(async (bal, index) => {
      return await Promise.all(
        bal["totalSupplies"].map(async (b, i) => {
          return index < CreateItem.length ? b[0].add(
            CreateItem[index]["amounts"].reduce(
              (total, arg) => total.add(arg),
              0
            )
          ) : b[0];
        })
      );
    })
  );

  await Promise.all(
    CreateItem.map(async (it, i) => {
      await itemsv2.checkBalances(
        it.accounts,
        Array(it.accounts.length).fill(itemids[i]),
        expectedBalance[i],
        expectedSupply[i],
        native
      );
    })
  );
}

async function assertDecimals(funct, zeroDecimals) {
  assert.equal(await execFunct(funct), utilities.numberToString(zeroDecimals || 0));
}

async function assertNotEqualCollection(funct, coll) {
  assert.notEqual(await execFunct(funct), coll);
}

async function assertEqualCollection(funct, coll) {
  assert.equal(await execFunct(funct), coll);
}

async function assertEqualHeaderHost(host1, host2) {
  assert.equal(host1, host2);
}

async function assertEqualHeaderUri(funct, uri) {
  assert.equal(await execFunct(funct), uri);
}

async function assertCheckHeader(header, funct) {
  var newHeader = await execFunct(funct);
  checkHeader(header, newHeader);
}

async function assertCheckFinalized(funct, finalized) {
  assert.equal(await execFunct(funct), finalized);
}

async function assertCheckIsApprovedForAll(funct, approved) {
  assert.equal(await execFunct(funct), approved);
}

function checkHeader(h1, h2) {
  /**
   * check that 2 object Header are equal
   */
  Object.keys(h1).forEach(
    (key) => isNaN(parseInt(key)) && assert.equal(h1[key], h2[key], key)
  );
  Object.keys(h2).forEach(
    (key) => isNaN(parseInt(key)) && assert.equal(h1[key], h2[key], key)
  );
}

function checkItem(h1, h2) {
  /**
   * check that 2 object CreateItem are equal
   */
  assert.equal(h1["collectionId"], h2["collectionId"]);
  checkHeader(h1.header, h2.header);
}

async function assertCheckCollection(items, collectionId) {
  items.map(async (item, index) => {
    assert.equal(
      await itemMainInterface.methods.collection(item).call(),
      collectionId
    );
  });
}

module.exports = {
  assertCheckBalanceSupply,
  assertCheckHeader,
  checkHeader,
  checkItem,
  assertCheckCollection,
  getItemIdFromLog,
  assertDecimals,
  assertNotEqualCollection,
  assertEqualCollection,
  assertEqualHeaderHost,
  assertEqualHeaderUri,
  assertCheckFinalized,
  assertCheckIsApprovedForAll,
  assertTransferBalance,
  assertBurnBalance,
  assertCheckBalance,
  createNoneBal,
};
