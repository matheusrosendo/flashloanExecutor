const bigdecimal = require("bigdecimal");
const assert = require('assert');
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
        for (let item of _blacklist) {
            if((item.DEX === _exchange && item.token1 === _token1 && item.token2 === _token2) || (item.DEX === _exchange && item.token1 === _token2 && item.token2 === _token1) ){
                found = true;
                break;
            }
        }
        return found;
    }

     /**
     * Searches for a item in the blacklist of UniswapV3 
     * @param {*} _exchangeList 
     * @param {*} _symbol 
     * @param {*} _DEX 
     * @returns 
     */
      static isBlacklistedUniswapV3(_blacklist, _token1, _token2, _fee){
        let found = false
        if(_blacklist){       
            for (let item of _blacklist) {
                if((item.token1 === _token1 && item.token2 === _token2 && item.fee === _fee)){
                    found = true;
                    break;
                }
            } 
        }
        return found;
    }

    /**
     * Searches for a address in the list 
     * @param {*} _exchangeList 
     * @param {*} _symbol 
     * @param {*} _DEX 
     * @returns 
     */
     static isBlacklistedAddress(_blacklist, _address){
        let found = false
        for (let item of _blacklist) {
            if((item.address === _address) ){
                found = true;
                break;
            }
        }
        return found;
    }

    /**
     * Searches for a item in the blacklist  
     * @param {*} _exchangeList 
     * @param {*} _symbol 
     * @param {*} _DEX 
     * @returns 
     */
     static isWhitelisted(_whitelist, _exchange, _token1, _token2){
        let found = false
        for (let item of _whitelist) {
            if((item.DEX === _exchange && item.token1 === _token1 && item.token2 === _token2) || (item.DEX === _exchange && item.token1 === _token2 && item.token2 === _token1) ){
                found = true;
                break;
            }
        }
        return found;
    }

    /**
     * Searches for a address in the whitelist and return it if found else undefined  
     * @param {*} _exchangeList 
     * @param {*} _symbol 
     * @param {*} _DEX 
     * @returns 
     */
     static getAddressFromWhitelist(_whitelist, _exchange, _token1, _token2){
        let address;
        if(_whitelist != undefined && _whitelist.length > 0){
            for (let item of _whitelist) {
                if((item.DEX === _exchange && item.token1 === _token1 && item.token2 === _token2) || (item.DEX === _exchange && item.token1 === _token2 && item.token2 === _token1) ){
                    address = item.address;
                    break;
                }
            }
        }
        return address;
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
        console.log("#### "+_DEX+" "+_token1+ " "+_token2+ " has $"+parseFloat(_contractTVL).toFixed(2)+ " | blacklisted ####");
        return _blacklist;
    }

    static addToBlacklistUniswapV3(_blacklist, _token1, _token2, _fee){
        if(!Util.isBlacklistedUniswapV3(_blacklist, _token1, _token2, _fee)){
            _blacklist.push({"token1":_token1, "token2":_token2, "fee":_fee});
            console.log("#### UniswapV3 "+_token1+ " "+_token2+ " fee = "+_fee+ " | blacklisted ####");
        }        
        return _blacklist;
    }

    /**
     * Assures any parameter is either truthy or equal to (0 or false)
     * @param {[]} _paramList 
     */
    static assertValidInputs(_paramList, _methodName){
        for(let index in _paramList){
            let param = _paramList[index]; 
            assert(param || (param === 0 || param === false), `param ${parseInt(index) + 1} in ${_methodName} is invalid or not defined`);
        }
    }

    /**
     * Add item to the blacklist
     * @param {*} _blacklist 
     * @param {*} _DEX 
     * @param {*} _token1 
     * @param {*} _token2 
     * @returns 
     */
     static addToWhitelist(_whitelist, _DEX, _token1, _token2, _address){
        _whitelist.push({"DEX":_DEX, "token1":_token1, "token2":_token2, "address":_address});
        console.log("#### "+_DEX+" "+_token1+ " "+_token2+ " found | whitelisted ####");
        return _whitelist;
    }

    static addListToWhitelist(_oldList, _newWhitelist){
        for(let item of _newWhitelist){
            _oldList.push(item);
        }
        return _oldList;
    }

    /**
     * @param {*} _amount 
     * @param {*} _decimals 
     * @returns String representing the interger amount to be used on blockchain transactions
     */
    static amountToBlockchain(_amount, _decimals = 18){
        try {            
            if(_amount === 0){
                return _amount;
            }
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
    static amountFromBlockchain(_amount, _decimals = 18){
        
        try {
            if(_amount === 0){
                return _amount;
            }
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

    /**
     * Creates a copied object
     * @param {*} _object 
     * @returns 
     */
    static copyObject(_object){
        try {  
            let newObject = {}
            let fields = Object.keys(_object);
            let values = Object.values(_object);
            for(let i = 0; i < fields.length; i++){
                newObject[fields[i]] = values[i];
            }
            return newObject;
        } catch (error) {
            throw new Error (error); 
        }
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static isAlchemyExceedingError(error){
        return (error.code && error.code == 429) || (error.message && error.message.search("exceeded") > -1);
    }

    static getAlchemyWaitingLongTime(){
        return 500 + (Math.random() * 10000);
    }

    static getAlchemyWaitingTime(){
        return 500 + (Math.random() * 1000);
    }
  
}

module.exports = Util
