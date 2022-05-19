const blockchainConnection = require("../util/blockchainConnection");
const utilities = require("../util/utilities");

async function mintErc20Wrapper(
    wrapper,
    token,
    tokenAmount,
    receiver,
    fromAccount,
    ethAmount = 0
) {
    var tx = await wrapper.methods.mint(token, tokenAmount, receiver).send(
        blockchainConnection.getSendingOptions({
            from: fromAccount,
            value: ethAmount,
        })
    );
    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
        .filter(
            (it) => it.topics[0] === web3.utils.sha3("Token(address,uint256)")
        )
        .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[2]));
    return { itemIds, tx };
}

async function mintErc20(
    wrapper,
    tokenAddress,
    tokenAmount,
    receiver,
    fromAccount,
    ethAmount = 0
) {
    var itemList = [];
    var tx;
    await Promise.all(
        tokenAddress.map(async (address, index) =>
            itemList.push({
                header: {
                    host: utilities.voidEthereumAddress,
                    name: "",
                    symbol: "",
                    uri: "",
                },
                collectionId: web3.eth.abi.encodeParameter("address", address),
                id: "0",
                accounts: receiver[index].map((address, index) =>
                    address == utilities.voidEthereumAddress
                        ? fromAccount
                        : address
                ),
                amounts: tokenAmount[index],
            })
        )
    );

    if (ethAmount == 0) {
        tx = await wrapper.methods
            .mintItems(itemList)
            .send(
                blockchainConnection.getSendingOptions({ from: fromAccount })
            );
    } else {
        tx = await wrapper.methods.mintItemsWithPermit(itemList, ["0x"]).send(
            blockchainConnection.getSendingOptions({
                from: fromAccount,
                value: ethAmount,
            })
        );
    }

    var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;

    var itemIds = logs
        .filter(
            (it) => it.topics[0] === web3.utils.sha3("Token(address,uint256)")
        )
        .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[2]));
    return { itemIds, tx };
}

async function revertMintErc20(
    wrapper,
    tokenAddress,
    tokenAmount,
    receiver,
    fromAccount,
    ethAmount = 0
) {
    var itemList = [];
    var tx;
    await Promise.all(
        tokenAddress.map(async (address, index) =>
            itemList.push({
                header: {
                    host: utilities.voidEthereumAddress,
                    name: "",
                    symbol: "",
                    uri: "",
                },
                collectionId: web3.eth.abi.encodeParameter("address", address),
                id: "0",
                accounts: receiver[index].map((address, index) =>
                    address == utilities.voidEthereumAddress
                        ? fromAccount
                        : address
                ),
                amounts: tokenAmount[index],
            })
        )
    );

    if (ethAmount != 0) {
        await catchCall(
            wrapper.methods.mintItems(itemList).send(
                blockchainConnection.getSendingOptions({
                    from: fromAccount,
                    value: ethAmount,
                })
            )
        );
    }
}

async function revertMintErc20Wrapper(
    wrapper,
    tokenAddress,
    tokenAmount,
    receiver,
    fromAccount,
    ethAmount = 0
) {
    var itemList = [];
    var tx;
    await Promise.all(
        tokenAddress.map(async (address, index) =>
            itemList.push({
                header: {
                    host: utilities.voidEthereumAddress,
                    name: "",
                    symbol: "",
                    uri: "",
                },
                collectionId: web3.eth.abi.encodeParameter("address", address),
                id: "0",
                accounts: receiver[index].map((address, index) =>
                    address == utilities.voidEthereumAddress
                        ? fromAccount
                        : address
                ),
                amounts: tokenAmount[index],
            })
        )
    );

    if (ethAmount != 0) {
        await catchCall(
            wrapper.methods.mintItems(itemList).send(
                blockchainConnection.getSendingOptions({
                    from: fromAccount,
                })
            ),
            "Only single transfers allowed for this token"
        );
    }
}

async function assertDecimals(wrapper, itemIds) {
    await Promise.all(
        itemIds.map(async (item, index) => {
            assert.equal(await wrapper.methods.decimals(item).call(), "18");
        })
    );
}

async function assertCheckErc20ItemBalance(
    wrapper,
    receivers,
    itemIds,
    totalAmounts
) {
    if (!Array.isArray(itemIds)) {
        itemIds = [itemIds];
    }
    await Promise.all(
        receivers.map(async (rec, ind) => {
            await Promise.all(
                rec.map(async (r, i) => {
                    assert.equal(
                        await wrapper.methods
                            .balanceOf(
                                r == utilities.voidEthereumAddress
                                    ? accounts[1]
                                    : r,
                                itemIds[ind]
                            )
                            .call(),
                        totalAmounts[ind][i]
                    );
                })
            );
        })
    );
}

async function mintItems721(
    tokenList,
    receivers,
    from,
    wrapper,
    nftTokenAddress,
    amount = "1000000000000000000"
) {
    var itemList = [];

    await Promise.all(
        receivers.map(async (address, index) =>
            itemList.push({
                header: {
                    host: utilities.voidEthereumAddress,
                    name: "",
                    symbol: "",
                    uri: "",
                },
                collectionId: web3.eth.abi.encodeParameter(
                    "address",
                    nftTokenAddress
                ),
                id: tokenList[index],
                accounts: [
                    address == utilities.voidEthereumAddress ? from : address,
                ],
                amounts: [amount],
            })
        )
    );

    var tx = await wrapper.methods
        .mintItems(itemList)
        .send(blockchainConnection.getSendingOptions({ from: from }));

    return tx;
}

async function generateCreateItem(
    tokenList,
    receivers,
    nftTokenAddress,
    amount
) {
    var itemList = [];

    await Promise.all(
        receivers.map(async (address, index) =>
            itemList.push({
                header: {
                    host: utilities.voidEthereumAddress,
                    name: "",
                    symbol: "",
                    uri: "",
                },
                collectionId: web3.eth.abi.encodeParameter(
                    "address",
                    nftTokenAddress[index]
                ),
                id: tokenList[index],
                accounts: [address],
                amounts: [amount[index]],
            })
        )
    );

    return itemList;
}

async function mintMultiItems721(
    tokenList,
    receivers,
    from,
    wrapper,
    nftTokenAddress,
    amount,
    revert = ""
) {
    var itemList = [];

    await Promise.all(
        receivers.map(async (address, index) =>
            itemList.push({
                header: {
                    host: utilities.voidEthereumAddress,
                    name: "",
                    symbol: "",
                    uri: "",
                },
                collectionId: web3.eth.abi.encodeParameter(
                    "address",
                    nftTokenAddress
                ),
                id: tokenList[index],
                accounts: address,
                amounts: amount[index],
            })
        )
    );

    if (revert == "") {
        var tx = await wrapper.methods
            .mintItems(itemList)
            .send(blockchainConnection.getSendingOptions({ from: from }));

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;

        var itemIds = logs
            .filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )
            .map((it) => web3.eth.abi.decodeParameter("uint256", it.topics[3]));

        return itemIds;
    }

    await catchCall(
        wrapper.methods
            .mintItems(itemList)
            .send(blockchainConnection.getSendingOptions({ from })),
        revert
    );
}

async function mintItems1155(
    tokenInstance,
    from,
    to,
    id,
    amount,
    data,
    itemId,
    wrapper,
    itemIdTo,
    itemIdAmount
) {
    if (itemId != null) {
        var previousItemBalance = await Promise.all(
            itemIdTo.map(
                async (toAddress, index) =>
                    await wrapper.methods
                        .balanceOf(
                            toAddress == utilities.voidEthereumAddress
                                ? from
                                : toAddress,
                            itemId
                        )
                        .call()
            )
        );

        var previousItemSupply = await wrapper.methods
            .totalSupply(itemId)
            .call();
    } else {
        var previousItemBalance = await Promise.all(
            itemIdTo.map(async (toAddress, index) => "0")
        );
        var previousItemSupply = "0";
    }

    var previousTokenBalance = await tokenInstance.methods
        .balanceOf(wrapper.options.address, id)
        .call();
    var tx = await tokenInstance.methods
        .safeTransferFrom(from, to, id, amount, data)
        .send(blockchainConnection.getSendingOptions({ from: from }));
    // assert.equal(
    //   await tokenInstance.methods.balanceOf(wrapper.options.address, id).call(),
    //   previousTokenBalance.add(amount)
    // );
    if (itemId == null) {
        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;
        var tokenId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )[0].topics[3]
        );
        await Promise.all(
            itemIdTo.map(async (toAddress, index) =>
                assert.equal(
                    await wrapper.methods
                        .balanceOf(
                            toAddress == utilities.voidEthereumAddress
                                ? from
                                : toAddress,
                            tokenId
                        )
                        .call(),
                    previousItemBalance[index].add(itemIdAmount[index])
                )
            )
        );
        assert.equal(
            await wrapper.methods.totalSupply(tokenId).call(),
            previousItemSupply.add(
                itemIdAmount.reduce((total, arg) => total.add(arg), 0)
            )
        );
        return tokenId;
    }

    await Promise.all(
        itemIdTo.map(async (toAddress, index) =>
            assert.equal(
                await wrapper.methods
                    .balanceOf(
                        toAddress == utilities.voidEthereumAddress
                            ? from
                            : toAddress,
                        itemId
                    )
                    .call(),
                previousItemBalance[index].add(itemIdAmount[index])
            )
        )
    );
    assert.equal(
        await wrapper.methods.totalSupply(itemId).call(),
        previousItemSupply.add(
            itemIdAmount.reduce((total, arg) => total.add(arg), 0)
        )
    );
    return itemId;
}

async function mintMultiItems1155(
    tokenInstance,
    from,
    to,
    id,
    amount,
    data,
    itemId,
    wrapper,
    itemIdTo,
    itemIdAmount
) {
    var tx = await tokenInstance.methods
        .safeTransferFrom(from, to, id, amount, data)
        .send(blockchainConnection.getSendingOptions({ from: from }));
    if (itemId == null) {
        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;
        var tokenId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )[0].topics[3]
        );
        return tokenId;
    }
    return itemId;
}

async function mintBatchItems1155(
    tokenInstance,
    from,
    to,
    id,
    amount,
    data,
    itemId
) {
    var tx = await tokenInstance.methods
        .safeBatchTransferFrom(from, to, id, amount, data)
        .send(blockchainConnection.getSendingOptions({ from: from }));
    if (itemId == null) {
        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;
        var tokenId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Token(address,uint256,uint256)")
            )[0].topics[3]
        );
        return tokenId;
    }
    return itemId;
}

async function safeTransfer1155(from, to, itemId, amount, data, tokenInstance) {
    var prevFromBalance = await tokenInstance.methods
        .balanceOf(from, itemId)
        .call();
    var prevToBalance = await tokenInstance.methods
        .balanceOf(to, itemId)
        .call();
    await tokenInstance.methods
        .safeTransferFrom(from, to, itemId, amount, data)
        .send(blockchainConnection.getSendingOptions({ from: from }));
    assert.equal(
        await tokenInstance.methods.balanceOf(from, itemId).call(),
        prevFromBalance.sub(amount)
    );
    assert.equal(
        await tokenInstance.methods.balanceOf(to, itemId).call(),
        prevToBalance.add(amount)
    );
}

async function safeBatchTransfer1155(
    from,
    to,
    itemId,
    amount,
    data,
    tokenInstance
) {
    var prevFromBalance = await Promise.all(
        itemId.map(
            async (id, index) =>
                await tokenInstance.methods.balanceOf(from, id).call()
        )
    );
    var prevToBalance = await Promise.all(
        itemId.map(
            async (id, index) =>
                await tokenInstance.methods.balanceOf(to, id).call()
        )
    );
    await tokenInstance.methods
        .safeBatchTransferFrom(from, to, itemId, amount, data)
        .send(blockchainConnection.getSendingOptions({ from: from }));
    await Promise.all(
        itemId.map(async (id, index) => {
            assert.equal(
                await tokenInstance.methods.balanceOf(from, id).call(),
                prevFromBalance[index].sub(amount[index])
            );
            assert.equal(
                await tokenInstance.methods.balanceOf(to, id).call(),
                prevToBalance[index].add(amount[index])
            );
        })
    );
}

async function burn721(from, operator, item, amount, data, tokenInstance) {
    var prevSupply = await tokenInstance.methods.totalSupply(item).call();
    var prevBalance = await tokenInstance.methods.balanceOf(from, item).call();
    await tokenInstance.methods
        .burn(from, item, amount, data)
        .send(blockchainConnection.getSendingOptions({ from: operator }));
    assert.equal(
        await tokenInstance.methods.totalSupply(item).call(),
        prevSupply.sub(amount)
    );

    assert.equal(
        await tokenInstance.methods.balanceOf(from, item).call(),
        prevBalance.sub(amount)
    );
}

async function burn1155(from, operator, item, amount, data, tokenInstance) {
    var prevSupply = await tokenInstance.methods.totalSupply(item).call();
    var prevBalance = await tokenInstance.methods.balanceOf(from, item).call();
    await tokenInstance.methods
        .burn(from, item, amount, data)
        .send(blockchainConnection.getSendingOptions({ from: operator }));
    assert.equal(
        await tokenInstance.methods.totalSupply(item).call(),
        prevSupply.sub(amount)
    );

    assert.equal(
        await tokenInstance.methods.balanceOf(from, item).call(),
        prevBalance.sub(amount)
    );
}

async function checkBalance(
    transaction,
    fromAddress,
    toAddress,
    amount,
    tokenInstance,
    tokenIds
) {
    var blockNumber =
        transaction.blockNumber ||
        (
            await web3.eth.getTransactionReceipt(
                transaction.transactionHash || transaction
            )
        ).blockNumber;
    blockNumber = parseInt(blockNumber) - 1;

    function balanceOf(token, subject, fromBlock) {
        return token.methods.balanceOf(subject).call({}, fromBlock);
    }

    function ownerOf(token, tokenId, fromBlock) {
        return token.methods.ownerOf(tokenId).call({}, fromBlock);
    }

    var fromBefore = await balanceOf(tokenInstance, fromAddress, blockNumber);
    var toBefore = await balanceOf(tokenInstance, toAddress, blockNumber);

    var fromAfter = await balanceOf(tokenInstance, fromAddress);
    var toAfter = await balanceOf(tokenInstance, toAddress);

    assert.equal(fromBefore.sub(amount), fromAfter);
    assert.equal(toBefore.add(amount), toAfter);

    await Promise.all(
        tokenIds.map(async (tokenId, index) => {
            var ownerBefore = await ownerOf(
                tokenInstance,
                tokenId,
                blockNumber
            );
            var ownerAfter = await ownerOf(tokenInstance, tokenId);

            assert.equal(ownerBefore, fromAddress);
            assert.equal(ownerAfter, toAddress);
        })
    );
}

async function checkBalance1155(
    transaction,
    fromAddress,
    toAddress,
    amount,
    tokenInstance,
    tokenId
) {
    var blockNumber =
        transaction.blockNumber ||
        (
            await web3.eth.getTransactionReceipt(
                transaction.transactionHash || transaction
            )
        ).blockNumber;
    blockNumber = parseInt(blockNumber) - 1;

    function balanceOf(token, subject, tokenId, fromBlock) {
        return token.methods.balanceOf(subject, tokenId).call({}, fromBlock);
    }

    var fromBefore = await balanceOf(tokenInstance, fromAddress, tokenId, blockNumber);
    var toBefore = await balanceOf(tokenInstance, toAddress, tokenId, blockNumber);

    var fromAfter = await balanceOf(tokenInstance, fromAddress, tokenId);
    var toAfter = await balanceOf(tokenInstance, toAddress, tokenId);

    assert.equal(fromBefore.sub(amount), fromAfter);
    assert.equal(toBefore.add(amount), toAfter);
}

async function checkBalanceItem(
    transaction,
    toAddress,
    amount,
    item,
    tokenInstance
) {
    var blockNumber =
        transaction.blockNumber ||
        (
            await web3.eth.getTransactionReceipt(
                transaction.transactionHash || transaction
            )
        ).blockNumber;
    blockNumber = parseInt(blockNumber) - 1;

    function balanceOf(token, subject, item, fromBlock) {
        return token.methods.balanceOf(subject, item).call({}, fromBlock);
    }

    var toBefore = await balanceOf(tokenInstance, toAddress, item, blockNumber);

    var toAfter = await balanceOf(tokenInstance, toAddress, item);

    assert.equal(toBefore.add(amount), toAfter);
}

async function checkSupply(transaction, amount, itemId, tokenInstance) {
    var blockNumber =
        transaction.blockNumber ||
        (
            await web3.eth.getTransactionReceipt(
                transaction.transactionHash || transaction
            )
        ).blockNumber;
    blockNumber = parseInt(blockNumber) - 1;

    var supplyBefore = await tokenInstance.methods
        .totalSupply(itemId)
        .call({}, blockNumber);

    var supplyAfter = await tokenInstance.methods.totalSupply(itemId).call();

    assert.equal(supplyBefore.add(amount), supplyAfter);
}

async function checkUnlockedAmount(tx, tokenAddress, tokenId, unlockKey, wrapper, amountToBurn){
    var blockNumber =
                tx.blockNumber ||
                (
                    await web3.eth.getTransactionReceipt(
                        tx.transactionHash || tx
                    )
                ).blockNumber;
    
    blockNumber = parseInt(blockNumber) - 1;

    var key = web3.utils.soliditySha3(
        { type: 'address', value: utilities.voidEthereumAddress },
        { type: 'address', value: tokenAddress },
        { type: 'uint256', value: tokenId },
        { type: 'uint256', value: "0" });

    var previousReserveData = await wrapper.methods
        .reserveData(key)
        .call({}, blockNumber); 

    var reserveData = await wrapper.methods
        .reserveData(key)
        .call(); 

    var previousUnwrappedReserveData = await Promise.all(
        unlockKey.map(async (key, index) => {
            return await wrapper.methods
                .reserveData(key)
                .call({}, blockNumber);
    }));

    var amount = await Promise.all(
        previousUnwrappedReserveData.map(async (reserve, index) => {
            return (reserve.amount).sub(amountToBurn[index]);
        })
    )
    
    await Promise.all(amount.map(async (am, index) => {
        assert.equal(reserveData.amount, previousReserveData.amount.add(am));
    })) 
} 

async function checkReserveData(
    transaction,
    sender,
    createItem,
    lock,
    blockToSkip,
    wrapper
) {
    await Promise.all(
        createItem.map(async (item, index) => {
            var blockNumber =
                transaction.blockNumber ||
                (
                    await web3.eth.getTransactionReceipt(
                        transaction.transactionHash || transaction
                    )
                ).blockNumber;
            var timeout = lock[index] ? blockNumber.add(blockToSkip) : "0";
            var tokenAddress = web3.eth.abi.decodeParameter(
                "address",
                item.collectionId
            );
            var tokenId = item.id;
            var senderAddress = lock[index]
                ? sender
                : utilities.voidEthereumAddress;

            var reserveData = await wrapper.methods
                .reserveData(tokenAddress, tokenId)
                .call();
            assert.equal(reserveData.timeout, timeout);
            assert.equal(reserveData.unwrapper, senderAddress);
        })
    );
}

module.exports = {
    mintErc20Wrapper,
    assertDecimals,
    assertCheckErc20ItemBalance,
    revertMintErc20Wrapper,
    mintItems721,
    mintMultiItems721,
    mintErc20,
    revertMintErc20,
    mintItems1155,
    mintMultiItems1155,
    mintBatchItems1155,
    safeTransfer1155,
    safeBatchTransfer1155,
    burn721,
    burn1155,
    generateCreateItem,
    checkBalance,
    checkBalanceItem,
    checkSupply,
    checkReserveData,
    checkBalance1155,
    checkUnlockedAmount
};

