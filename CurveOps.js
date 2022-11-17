/**
 * used to interact with Curve smart contracts
 * @author Matheus Rosendo
 */

const {BlockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
const Util = require("./Util.js");
const ERC20ops = require("./ERC20ops.js");
const { assert } = require("chai");

class CurveOps {
    constructor (_GLOBAL){
        this.GLOBAL = _GLOBAL;
    }

    /**
     * query amount out of given token in and amount in on curve pool3
     * @param {*} _amountIn 
     * @param {*} _tokenIn 
     * @param {*} _tokenOut 
     * @param {*} _times 
     * @returns 
     */
    queryAmountOut(_routerAddress, _amountIn, _tokenIn, _tokenOut, _times = 6){
        Util.assertValidInputs([_routerAddress, _amountIn, _tokenIn, _tokenOut], "queryAmountOut");
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            let totalTimes = new Array(_times).fill(1);
            for (let shot in totalTimes){
                try {    
                    let amountInWei = Util.amountToBlockchain(_amountIn, _tokenIn.decimals);
                    let pool3Contract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].CURVE_POOL3_ABI, _routerAddress, { from: this.GLOBAL.ownerAddress });
                    let tokenInPool3Index = BlockchainConfig.blockchain[this.GLOBAL.blockchain].CURVE_STABLECOINS_POOL3.indexOf(_tokenIn.address);
                    let tokenOutPool3Index = BlockchainConfig.blockchain[this.GLOBAL.blockchain].CURVE_STABLECOINS_POOL3.indexOf(_tokenOut.address);
                    assert(tokenInPool3Index >= 0, "token in not found in pool2 index list in blockchainconfig");
                    assert(tokenOutPool3Index >= 0, "token out not found in pool2 index list in blockchainconfig");
                    let amountOutWei = await pool3Contract.methods.get_dy(tokenInPool3Index, tokenOutPool3Index, amountInWei).call();
                    let amountOut = Util.amountFromBlockchain(amountOutWei, _tokenOut.decimals);
                    //inform if it is in the second try and so forth
                    if(parseInt(shot) > 0){
                        console.log(`##### amount out got it in SHOT ${parseInt(shot)+1} #####`);
                    }
                    resolve(amountOut);
                    break;
                } catch (error) {
                    //alchemy error code for exceeding units per second capacity. 
                    if ( Util.isAlchemyExceedingError(error)){                                            
                        let waitTimeInMs = Util.getAlchemyWaitingTime();
                        console.log(`##### trying to get token0 again in ${Number(waitTimeInMs).toFixed(2)} ms... #####`);
                        await Util.sleep(waitTimeInMs);
                    } else {
                        console.log(`### error on query Curve ${_tokenIn.address} ${_tokenOut.address} error: ${error} ### `)
                        reject(0.0);
                        break
                    }
                }
            }
        });
        return txPromise;  
    } 

    /**
     * Queries balance of given token on pool3 contract on curve
     * @param {*} _tokenIn
     * @returns 
     */
     queryBalanceOf (_poolAddress, _tokenIn){
        let txPromise = new Promise(async (resolve, reject) =>{ 
        try {
            assert(_tokenIn.pool3index != undefined, "Error: pool3index not found on token properties!");
            let pool3Contract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].CURVE_POOL3_ABI, _poolAddress, { from: this.GLOBAL.ownerAddress });
            let balanceWei = await  pool3Contract.methods.balances(_tokenIn.pool3index).call()     
                       
            let balance = Util.amountFromBlockchain(balanceWei, _tokenIn.decimals);
            resolve(balance);                               
        } catch (error) {
            if (error.reason){
                error = error.reason
            }
            console.log(`### error on query Pool3 Curve balance of ${_tokenIn.address} error: ${error} ### `)
            reject(0.0);
        }
    });
    return txPromise;  

    }

}

module.exports = CurveOps;