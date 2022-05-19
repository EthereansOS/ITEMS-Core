if (!String.prototype.format) {
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] != 'undefined' ? args[number] : match;
        });
    };
}

var voidEthereumAddress = "0x0000000000000000000000000000000000000000";

var voidBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

global.formatMoneyDecPlaces = 4;

function fromDecimalsRaw(n, d, noFormat) {
    n = (n && n.value || n);
    d = (d && d.value || d);
    if (!n || !d) {
        return "0";
    }
    var decimals = (typeof d).toLowerCase() === 'string' ? parseInt(d) : d;
    var symbol = toEthereumSymbol(decimals);
    if (symbol) {
        var result = web3.utils.fromWei(((typeof n).toLowerCase() === 'string' ? n : numberToString(n)).split('.')[0], symbol);
        return noFormat === true ? result : formatMoney(result);
    }
    var number = (typeof n).toLowerCase() === 'string' ? parseInt(n) : n;
    if (!number || isNaN(number)) {
        return '0';
    }
    var nts = parseFloat(numberToString((number / (decimals < 2 ? 1 : Math.pow(10, decimals)))));
    nts = numberToString(nts);
    return noFormat === true ? nts : formatMoney(nts);
}

function toDecimalsRaw(n, d) {
    n = (n && n.value || n);
    d = (d && d.value || d);
    if (!n || !d) {
        return "0";
    }
    var decimals = (typeof d).toLowerCase() === 'string' ? parseInt(d) : d;
    var symbol = toEthereumSymbol(decimals);
    if (symbol) {
        return web3.utils.toWei((typeof n).toLowerCase() === 'string' ? n : numberToString(n), symbol);
    }
    var number = (typeof n).toLowerCase() === 'string' ? parseFloat(n) : n;
    if (!number || isNaN(number)) {
        return "0";
    }
    return numberToString(number * (decimals < 2 ? 1 : Math.pow(10, decimals)));
}

function numberToString(num, locale) {
    if (num === undefined || num === null) {
        num = 0;
    }
    if ((typeof num).toLowerCase() === 'string') {
        return num.split(',').join('');
    }
    let numStr = String(num);

    if (Math.abs(num) < 1.0) {
        let e = parseInt(num.toString().split('e-')[1]);
        if (e) {
            let negative = num < 0;
            if (negative) num *= -1
            num *= Math.pow(10, e - 1);
            numStr = '0.' + (new Array(e)).join('0') + num.toString().substring(2);
            if (negative) numStr = "-" + numStr;
        }
    } else {
        let e = parseInt(num.toString().split('+')[1]);
        if (e > 20) {
            e -= 20;
            num /= Math.pow(10, e);
            numStr = num.toString() + (new Array(e + 1)).join('0');
        }
    }
    if (locale === true) {
        var numStringSplitted = numStr.split(' ').join('').split('.');
        return parseInt(numStringSplitted[0]).toLocaleString() + (numStringSplitted.length === 1 ? '' : (Utils.decimalsSeparator + numStringSplitted[1]))
    }
    return numStr;
}

function normalizeValue(amount, decimals) {
    return web3.utils.toBN(amount).mul(web3.utils.toBN(10 ** (18 - decimals))).toString();
}

function formatMoney(value, decPlaces, thouSeparator, decSeparator) {
    value = (typeof value).toLowerCase() !== 'number' ? parseFloat(value) : value;
    var n = value,
        decPlaces = isNaN(decPlaces = Math.abs(decPlaces)) ? global.formatMoneyDecPlaces : decPlaces,
        decSeparator = decSeparator == undefined ? "." : decSeparator,
        thouSeparator = thouSeparator == undefined ? "," : thouSeparator,
        sign = n < 0 ? "-" : "",
        i = parseInt(n = Math.abs(+n || 0).toFixed(decPlaces)) + "",
        j = (j = i.length) > 3 ? j % 3 : 0;
    var result = sign + (j ? i.substr(0, j) + thouSeparator : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thouSeparator) + (decPlaces ? decSeparator + Math.abs(n - i).toFixed(decPlaces).slice(2) : "");
    return eliminateFloatingFinalZeroes(result, decSeparator);
}

function formatNumber(value) {
    return parseFloat(numberToString(value).split(',').join(''));
}

function getRandomArrayIndex(array) {
    return Math.floor(Math.random() * array.length);
}

function getRandomArrayElement(array) {
    return array[getRandomArrayIndex(array)];
}

function eliminateFloatingFinalZeroes(value, decSeparator) {
    decSeparator = decSeparator || '.';
    if (value.indexOf(decSeparator) === -1) {
        return value;
    }
    var split = value.split(decSeparator);
    while (split[1].endsWith('0')) {
        split[1] = split[1].substring(0, split[1].length - 1);
    }
    return split[1].length === 0 ? split[0] : split.join(decSeparator);
}

function sleep(millis) {
    return new Promise(function(ok) {
        setTimeout(ok, millis || 300);
    });
}

global.op = function op(a, operator, b) {
    var operations = {
        '+' : 'add',
        '-' : 'sub',
        '*' : 'mul',
        '/' : 'div'
    };
    a = (a.add ? a.toString() : numberToString(a)).split(',').join('').split('.')[0];
    b = (b.add ? b.toString() : numberToString(b)).split(',').join('').split('.')[0];
    return web3.utils.toBN(a)[operations[operator] || operator](web3.utils.toBN(b)).toString();
}

global.add = function add(a, b) {
    return op(a, '+', b);
}

global.sub = function sub(a, b) {
    return op(a, '-', b);
}

global.mul = function mul(a, b) {
    return op(a, '*', b);
}

global.div = function div(a, b) {
    return op(a, '/', b);
}

String.prototype.add = String.prototype.add || function add(b) {
    return op(this, '+', b);
};

String.prototype.sub = function sub(b) {
    return op(this, '-', b);
};

String.prototype.mul = String.prototype.mul || function mul(b) {
    return op(this, '*', b);
};

String.prototype.div = String.prototype.div || function div(b) {
    return op(this, '/', b);
};

String.prototype.toDecimals = String.prototype.toDecimals || function toDecimals(dec) {
    return toDecimalsRaw(this, dec);
};

String.prototype.fromDecimals = String.prototype.fromDecimals || function fromDecimals(dec, noFormat) {
    return fromDecimalsRaw(this, dec, noFormat);
};

Number.prototype.add = Number.prototype.add || function add(b) {
    return op(this, '+', b);
};

Number.prototype.sub = Number.prototype.sub || function sub(b) {
    return op(this, '-', b);
};

Number.prototype.mul = Number.prototype.mul || function mul(b) {
    return op(this, '*', b);
};

Number.prototype.div = Number.prototype.div || function div(b) {
    return op(this, '/', b);
};

Number.prototype.toDecimals = Number.prototype.toDecimals || function toDecimals(dec) {
    return toDecimalsRaw(this, dec);
};

function toEthereumSymbol(decimals) {
    var symbols = {
        "noether": "0",
        "wei": "1",
        "kwei": "1000",
        "Kwei": "1000",
        "babbage": "1000",
        "femtoether": "1000",
        "mwei": "1000000",
        "Mwei": "1000000",
        "lovelace": "1000000",
        "picoether": "1000000",
        "gwei": "1000000000",
        "Gwei": "1000000000",
        "shannon": "1000000000",
        "nanoether": "1000000000",
        "nano": "1000000000",
        "szabo": "1000000000000",
        "microether": "1000000000000",
        "micro": "1000000000000",
        "finney": "1000000000000000",
        "milliether": "1000000000000000",
        "milli": "1000000000000000",
        "ether": "1000000000000000000",
        "kether": "1000000000000000000000",
        "grand": "1000000000000000000000",
        "mether": "1000000000000000000000000",
        "gether": "1000000000000000000000000000",
        "tether": "1000000000000000000000000000000"
    };
    var d = "1" + (new Array(decimals instanceof Number ? decimals : parseInt(decimals) + 1)).join('0');
    var values = Object.entries(symbols);
    for (var i in values) {
        var symbol = values[i];
        if (symbol[1] === d) {
            return symbol[0];
        }
    }
}

module.exports = {
    voidEthereumAddress,
    voidBytes32,
    fromDecimals : fromDecimalsRaw,
    toDecimals : toDecimalsRaw,
    numberToString,
    formatNumber,
    formatMoney,
    eliminateFloatingFinalZeroes,
    toEthereumSymbol,
    sleep,
    normalizeValue,
    getRandomArrayIndex,
    getRandomArrayElement,
    op,
    add,
    sub,
    mul,
    div
}