const {BlockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
const Util = require("./Util.js");
const ERC20ops = require("./ERC20ops.js");

class UniswapV2ops {
    constructor (_GLOBAL){
        this.GLOBAL = _GLOBAL;
    }

    getNetwork(){
        return this.GLOBAL.network;
    }

   
 
    async queryAmountOut(_amountIn, _tokenIn, _tokenOut){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {    
                let amountInWei = Util.amountToBlockchain(_amountIn, _tokenIn.decimals);
                let routerContract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV2_ROUTER_ABI, BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV2_ROUTER_ADDRESS, { from: this.GLOBAL.ownerAddress });
                let amountsOutWei = await routerContract.methods.getAmountsOut(amountInWei, [_tokenIn.address, _tokenOut.address]).call();
                let amountOut = Util.amountFromBlockchain(amountsOutWei[1], _tokenOut.decimals);
                resolve(amountOut);
            } catch (error) {
                console.log(`### error on query UniswapV2 ${_tokenIn.address} ${_tokenOut.address} error: ${error} ### `)
                reject(0.0);
            }
        });
        return txPromise;  
    } 

    /**
     * Try to get reserves 4 times
     * @param {*} _contract 
     * @returns 
     */
     queryReserves (_pairABI, _pairAddress){
        let contract = new this.GLOBAL.web3Instance.eth.Contract(_pairABI, _pairAddress);
        let callReservesPromise = new Promise (async (resolve, reject) =>{            
            let maxMsToTryAgain = 5000;
            let totalTimes = new Array(6).fill(1);
            for (let shot in totalTimes){
                try {
                    let reserves = await contract.methods.getReserves().call();
                    //inform if it is in the second try and so forth
                    if(parseInt(shot) > 0){
                        console.log(`##### reserves got it in SHOT ${parseInt(shot)+1} #####`);
                    }
                    resolve(reserves);
                    break;
                } catch (error) {

                    //alchemy error code for exceeding units per second capacity. 
                    if (error.code && error.code == 429){
                                            
                        let waitTimeInMs = Math.random() * maxMsToTryAgain;
                        console.log("##### trying to get reserves again... #####");
                        sleep(waitTimeInMs);
                    } else {
                        reject([0,0]);
                    }
                }
            }
        });
        return callReservesPromise;
    }


}

module.exports = UniswapV2ops;