describe("Item V2", () => {
    it("Compile", async () => {
        var ItemMainInterface = await compile('impl/ItemMainInterface.sol');
        var ItemInteroperableInterface = await compile('impl/ItemInteroperableInterface.sol');
        console.log(ItemMainInterface);
        console.log(ItemInteroperableInterface);
    });
});