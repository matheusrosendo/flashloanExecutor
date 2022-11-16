const {BlockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
const Util = require("./Util.js");
const ERC20ops = require("./ERC20ops.js");
const { assert } = require("chai");

class CurveOps {
    constructor (_GLOBAL){
        this.GLOBAL = _GLOBAL;
    }

    getNetwork(){
        return this.GLOBAL.network;
    }

    async queryAmountOut(_amountIn, _tokenIn, _tokenOut, _poolAddress){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {    
                let amountInWei = Util.amountToBlockchain(_amountIn, _tokenIn.decimals);
                let pool3Contract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].CURVE_POOL3_ABI, _poolAddress, { from: this.GLOBAL.ownerAddress });
                let tokenInPool3Index = BlockchainConfig.blockchain[this.GLOBAL.blockchain].CURVE_STABLECOINS_POOL3.indexOf(_tokenIn.address);
                let tokenOutPool3Index = BlockchainConfig.blockchain[this.GLOBAL.blockchain].CURVE_STABLECOINS_POOL3.indexOf(_tokenOut.address);
                assert(tokenInPool3Index >= 0, "token in not found in pool2 index list in blockchainconfig");
                assert(tokenOutPool3Index >= 0, "token out not found in pool2 index list in blockchainconfig");
                let amountOutWei = await pool3Contract.methods.get_dy(tokenInPool3Index, tokenOutPool3Index, amountInWei).call();
                let amountOut = Util.amountFromBlockchain(amountOutWei, _tokenOut.decimals);
                resolve(amountOut);
            } catch (error) {
                console.log(`### error on query Curve ${_tokenIn.address} ${_tokenOut.address} error: ${error} ### `)
                reject(0.0);
            }
        });
        return txPromise;  
    } 


}

module.exports = CurveOps;