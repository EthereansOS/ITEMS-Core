var path = require("path");
var fs = require("fs");
var compile = require("./compile");
var glob = require("glob");

var noBin = process.argv.indexOf('nobin') !== -1;

async function main() {
    var baseLocation = path.resolve(__dirname, "..", "contracts").split("\\").join("/");
    var files = await new Promise(function(end) {
        glob(baseLocation + '/**/*.sol', {}, (err, files) => end(files.map(it => it.split('\\').join('/').split(baseLocation).join('').substring(1))));
    });
    var abis = [];
    var bins = [];
    var cache = {};
    for(var i in files) {
        var file = files[i = parseInt(i)];
        var name = file.substring(file.lastIndexOf("/") + 1).split(".sol").join("") + "ABI";
        if(cache[name]) {
            continue;
        }
        try {
            var Contract = await compile(file);
            abis.push(`\n    "${name}": ${JSON.stringify(cache[name] = Contract.abi)}`);
            Contract.bin !== '0x' && bins.push(`\n    "${name.substring(0, name.length - 3) + 'BIN'}": "${Contract.bin}"`);
        } catch(e) {
        }
    }
    var data = path.resolve(__dirname, '..', 'data');
    try {
        fs.mkdirSync(data);
    } catch(e) {
    }
    try {
        fs.unlinkSync(path.resolve(data, 'abis.json'));
    } catch(e) {
    }
    try {
        fs.unlinkSync(path.resolve(data, 'compiled.json'));
    } catch(e) {
    }
    fs.writeFileSync(path.resolve(data, noBin ? 'abis.json' : 'compiled.json'), "{" + abis.join(',') + (noBin ? '' : (',' + bins.join(','))) + "\n}");
}

main().catch(console.error).then(() => process.exit(0));