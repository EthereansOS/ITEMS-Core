var path = require("path");
var os = require('os');
var fs = require("fs");
var solidityManager = require('solc-vm/solc-manager');
var solidityDownloader = require('solc-vm/solc-downloader');
var glob = require("glob");
var { exec } = require('child_process');

function cleanOutput(text) {
    var lines = text.split('\n').join('').split('\r').join('').split('======= ');
    var output = {};
    for(line of lines) {
        if(line === '') {
            continue;
        }
        var split = line.split(' =======Binary:');
        var file = split[0].substring(0, split[0].lastIndexOf(':'));
        var contract = split[0].substring(split[0].lastIndexOf(':') + 1);
        output[file] = output[file] || {};
        output[file][contract] = output[file][contract] || {};
        var data = split[1].split('Contract JSON ABI');
        output[file][contract].bin = '0x' + data[0];
        output[file][contract].abi = JSON.parse(data[1]);
    }
    return output;
}

global.solidityVersion = global.solidityVersion || process.env.npm_package_config_solidityVersion;
if(!global.solidityVersion) {
    var location = path.resolve(__dirname, "package.json");
    while(!fs.existsSync(location)) {
        location = path.resolve(path.dirname(location), "..", "package.json");
    }
    global.solidityVersion = process.env.npm_package_config_solidityVersion = JSON.parse(fs.readFileSync(location, "UTF-8")).config.solidityVersion;
}

var nodeModulesLocation = path.resolve(__dirname, "node_modules");
while(!fs.existsSync(nodeModulesLocation)) {
    nodeModulesLocation = path.resolve(path.dirname(nodeModulesLocation), "..", "node_modules");
}
nodeModulesLocation = nodeModulesLocation.split("\\").join("/");

var importedNodeModulesContracts = new Promise(async function(ok) {
    var locations = {};
    await new Promise(function(end) {
        glob(nodeModulesLocation + '/**/*.sol', {}, (err, files) => {
            files.forEach(it => {
                var name = it.split('\\').join('/').split(nodeModulesLocation).join('');
                locations[name.substring(1, name.indexOf('/', 1) + 1)] = true;
            });
            end();
        });
    });
    return ok(Object.keys(locations).map(it => `${it}=${nodeModulesLocation}/${it}`).join(' '));
});

module.exports = async function compile(file, contractName) {
    if (!solidityManager.hasBinaryVersion(solidityVersion)) {
        await new Promise(ok => solidityDownloader.downloadBinary(solidityVersion, ok));
    }
    var baseLocation = path.resolve(__dirname, "..", "contracts").split("\\").join("/");
    var fileLocation = (file + (file.indexOf(".sol") === -1 ? ".sol" : "")).split("\\").join("/");
    contractName = contractName || fileLocation.substring(fileLocation.lastIndexOf("/") + 1).split(".sol").join("");

    var location = path.resolve(baseLocation, fileLocation).split("\\").join("/");
    var removeAtEnd = !fs.existsSync(location);
    removeAtEnd && fs.writeFileSync(location = path.join(os.tmpdir(), `${contractName}_${new Date().getTime()}.sol`).split('\\').join('/'), file);

    return await new Promise(async function(ok, ko) {
        exec(`${solidityManager.getBinary(solidityVersion)} ${await importedNodeModulesContracts} --optimize --abi --bin --allow-paths ${baseLocation} ${location}`, (error, stdout, stderr) => {
            try {
                removeAtEnd && fs.unlinkSync(location);
            } catch(e) {
            }
            if (error) {
                return ko(error);
            }
            if (stderr && stderr.toLowerCase().indexOf('warning: ') === -1) {
                return ko(stderr);
            }
            var output = cleanOutput(stdout)[location][contractName];
            if(!output) {
                stderr && console.log(stderr);
                return ko(new Error("No output"));
            }
            stderr && (output.warning = stderr);
            return ok(output);
        });
    });
};