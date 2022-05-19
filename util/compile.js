var path = require("path");
var os = require('os');
var fs = require("fs");
var solidityManager = require('solc-vm/solc-manager');
var solidityDownloader = require('solc-vm/solc-downloader');
var glob = require("glob");
var { spawn } = require('child_process');

var baseLocation = path.resolve(__dirname, "..", "contracts").split("\\").join("/");

async function parseOutput(text) {
    var json = JSON.parse(text);
    var output = {};
    for(var entry of Object.entries(json.contracts)) {
        var location = entry[0].split('\\').join('/');
        var contractName = location.split('\\').join('/').split('/');
        contractName = contractName[contractName.length - 1].split(':')[1];
        location = location.substring(0, location.lastIndexOf(':'));
        var contract = {
            ...entry[1],
            contractName,
        };
        json.sources[location] && (contract.ast = json.sources[location].AST);
        contract.abi = typeof contract.abi === 'string' ? JSON.parse(contract.abi) : contract.abi;
        global.onCompilation && global.onCompilation(contract);
        (output[location] = output[location] || {})[contractName] = contract;
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
    return ok(Object.keys(locations).map(it => `${it}=${nodeModulesLocation}/${it}`));
});

module.exports = async function compile(file, contractName, solidityVersion) {
    if (!solidityManager.hasBinaryVersion(solidityVersion = solidityVersion || global.solidityVersion)) {
        await new Promise(ok => solidityDownloader.downloadBinary(solidityVersion, ok));
    }
    var fileLocation = (file + (file.indexOf(".sol") === -1 ? ".sol" : "")).split("\\").join("/");

    var location = path.resolve(baseLocation, fileLocation).split("\\").join("/");
    var removeAtEnd = !fs.existsSync(location);

    contractName = contractName ? contractName : !fs.existsSync(location) ? "Contract" : location.substring(location.lastIndexOf("/") + 1).split(".sol").join("");

    removeAtEnd && fs.writeFileSync(location = path.join(os.tmpdir(), `${contractName}_${new Date().getTime()}.sol`).split('\\').join('/'), file);

    return await new Promise(async function(ok, ko) {
        var exeFile = solidityManager.getBinary(solidityVersion);
        var args = [
            ...(await importedNodeModulesContracts),
            '--optimize',
            '--combined-json',
            'abi,ast,bin,bin-runtime,srcmap,srcmap-runtime',
            '--allow-paths',
            baseLocation,
            location
        ];
        var child;
        try {
            child = spawn(exeFile, args);
        } catch(e) {
            return ko(e);
        }

        var stderr  = '';
        var stdout = '';

        child.stdout.on('data', function (data) {
            stdout += data;
        });

        child.stderr.on('data', function (data) {
            stderr += data;
        });

        child.on('close', async function () {
            var output;
            try {
                output = (await parseOutput(stdout))[location][contractName];
            } catch(e) {
            }
            try {
                removeAtEnd && fs.unlinkSync(location);
            } catch(e) {
            }
            if (stderr && stderr.toLowerCase().indexOf('warning: ') === -1) {
                return ko(new Error(stderr));
            }
            if(!output) {
                return ko(new Error((stderr ? (stderr + '\n') : '') + "No output for contract " + contractName + " at location " + location + "."));
            }
            stderr && (output.warning = stderr);
            return ok(output);
        });
    });
};