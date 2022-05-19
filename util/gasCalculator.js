var {parse} = require('node-html-parser');

var url = "https://etherscan.io/gastracker/";
var request = require('http' + (url.indexOf('https') === 0 ? 's' : ''));

function numberToString(num, locale) {
    if (num === undefined || num === null) {
        num = 0;
    }
    if ((typeof num).toLowerCase() === 'string') {
        return num;
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
};

module.exports = function calculate() {
    return new Promise(function(ok) {
        var backup = function backup() {
            return ok("2000000000");
        }
        request.get(url, res => {
            res.setEncoding("utf8");
            let body = "";
            res.on("data", data => {
              body += data;
            });
            res.on("end", () => {
                try {
                    var gas = parseInt(parse(body).querySelectorAll("#spanHighPrice")[0].innerHTML.trim());
                    return ok(numberToString(parseInt(numberToString(gas * 1.3))));
                } catch(e) {
                    console.error(e);
                    backup();
                }
            });
            res.on("error", function(e) {
                console.error(e);
                backup();
            });
          });
    });
};