var path = require("path");
var fs = require("fs");
var compile = require("./compile");
var glob = require("glob");

async function main() {
    var baseLocation = path.resolve(__dirname, "..", "contracts").split("\\").join("/");
    var files = await new Promise(function(end) {
        glob(baseLocation + '/**/*.sol', {}, (err, files) => end(files.map(it => it.split('\\').join('/').split(baseLocation).join('').substring(1))));
    });
    var abis = "";
    for(var i in files) {
        var file = files[i = parseInt(i)];
        var name = file.substring(file.lastIndexOf("/") + 1).split(".sol").join("") + "ABI";
        abis += `\n    "${name}": ${JSON.stringify((await compile(file)).abi)}${i === files.length - 1 ? '' : ','}`
    }
    var data = path.resolve(__dirname, '..', 'data');
    try {
        fs.mkdirSync(data);
    } catch(e) {
    }
    fs.writeFileSync(path.resolve(data, 'abis.json'), "{" + abis + "\n}");
}

main().catch(console.error).then(() => process.exit(0));