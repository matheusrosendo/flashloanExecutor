const bigdecimal = require("bigdecimal");
class Util {
    

    static padTo2Digits(num) {
        return num.toString().padStart(2, '0');
    }
    
    static formatDateTime(date) {
        return (
        [
            Util.padTo2Digits(date.getDate()),
            Util.padTo2Digits(date.getMonth() + 1),
            date.getFullYear(),
        ].join('/') +
        ' ' +
        [
            Util.padTo2Digits(date.getHours()),
            Util.padTo2Digits(date.getMinutes()),
            Util.padTo2Digits(date.getSeconds()),
        ].join(':')
        );
    }

    static formatDateTimeForFilename(date) {
        return (
        [
            date.getFullYear(),
            Util.padTo2Digits(date.getDate()),
            Util.padTo2Digits(date.getMonth() + 1),
        ].join('-') +
        '_' +
        [
            Util.padTo2Digits(date.getHours()),
            Util.padTo2Digits(date.getMinutes()),
        ].join('-')
        );
    }

    static formatDateTimeWithSecondsForFilename(date) {
        return (
        [
            date.getFullYear(),
            Util.padTo2Digits(date.getMonth() + 1),
            Util.padTo2Digits(date.getDate()),            
        ].join('-') +
        '_' +
        [
            Util.padTo2Digits(date.getHours()),
            Util.padTo2Digits(date.getMinutes()),
            Util.padTo2Digits(date.getSeconds()),
        ].join('-')
        );
    }

    static formatDate(date) {
        return (
        [
            Util.padTo2Digits(date.getDate()),
            Util.padTo2Digits(date.getMonth() + 1),
            date.getFullYear(),
        ].join('/') 
        );
    }
    static formatTimeWithSeconds(date) {
        return (
       
        [
            Util.padTo2Digits(date.getHours()),
            Util.padTo2Digits(date.getMinutes()),
            Util.padTo2Digits(date.getSeconds()),
        ].join(':')
        );
    }

    static formatTimeForFileName(date) {
        return (
       
        [
            Util.padTo2Digits(date.getHours()),
            Util.padTo2Digits(date.getMinutes()),
        ].join('-')
        );
    }

    /**
     * Searches for a token in the list 
     * @param {*} _exchangeList 
     * @param {*} _symbol 
     * @param {*} _DEX 
     * @returns 
     */
    static isTokenInExchangeList(_exchangeList, _symbol, _DEX){
        let found = false
        _exchangeList.every((item) => {
            if(item.exchange === _DEX.name){
                if(item.tokens.indexOf(_symbol) > -1){
                    found = true;
                    return false; //return of 'every' (if false it breaks the loop)
                }
            }
            return true; //return of 'every' (if true it continues the loop)
        })
        return found;
    }

    /**
     * Searches for a item in the blacklist  
     * @param {*} _exchangeList 
     * @param {*} _symbol 
     * @param {*} _DEX 
     * @returns 
     */
     static isBlacklisted(_blacklist, _exchange, _token1, _token2){
        let found = false
        _blacklist.every((item) => {
            if((item.DEX === _exchange && item.token1 === _token1 && item.token2 === _token2) || (item.DEX === _exchange && item.token1 === _token2 && item.token2 === _token1) ){
                found = true;
                return false; //return of 'every' (if false it breaks the loop)
            }
            return true; //return of 'every' (if true it continues the loop)
        })
        return found;
    }

    /**
     * Add item to the blacklist
     * @param {*} _blacklist 
     * @param {*} _DEX 
     * @param {*} _token1 
     * @param {*} _token2 
     * @returns 
     */
    static addToBlacklist(_blacklist, _DEX, _token1, _token2, _contractTVL, _address){
        _blacklist.push({"DEX":_DEX, "token1":_token1, "token2":_token2, "TVL":_contractTVL, "address":_address});
        console.log("####"+_DEX+" "+_token1+ " "+_token2+ " has $"+parseFloat(_contractTVL).toFixed(2)+ " | blacklisted ####");
        return _blacklist;
    }

    /**
     * @param {*} _amount 
     * @param {*} _decimals 
     * @returns String representing the interger amount to be used on blockchain transactions
     */
    static amountToBlockchain(_amount, _decimals){
        try {            
        
            let amountInBig = new bigdecimal.BigDecimal(_amount);
            let decimalsInt = new bigdecimal.BigDecimal(Math.pow(10, parseInt(_decimals)));
            let bigResult, strResult;
            if(amountInBig > 0 && decimalsInt > 0){
                bigResult = amountInBig.multiply(decimalsInt);
                strResult = bigResult.toString().split(".")[0]; 
            }
            
            return strResult;
        } catch (error) {
            throw new Error (error); 
        }
    }

    /**
     * 
     * @param {*} _amount 
     * @param {*} _decimals 
     * @returns Number to be used outside blockchain
     */
    static amountFromBlockchain(_amount, _decimals){
        
        try {
            let amountInBig = new bigdecimal.BigDecimal(_amount);
            let decimalsInt = new bigdecimal.BigDecimal(Math.pow(10, parseInt(_decimals)));
            let newResult;
            if(amountInBig > 0 && decimalsInt > 0){
                newResult = Number(amountInBig.divide(decimalsInt)); 
            }

            return newResult;
        } catch (error) {
            throw new Error (error); 
        }
    }
  
}

module.exports = Util
