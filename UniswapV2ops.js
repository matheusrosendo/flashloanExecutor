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

    
    async queryAmountOut(_amountIn, _tokenIn, _tokenOut, _times = 6){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            let totalTimes = new Array(_times).fill(1);
            for (let shot in totalTimes){
                try {    
                    let amountInWei = Util.amountToBlockchain(_amountIn, _tokenIn.decimals);
                    let routerContract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV2_ROUTER_ABI, BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV2_ROUTER_ADDRESS, { from: this.GLOBAL.ownerAddress });
                    let amountsOutWei = await routerContract.methods.getAmountsOut(amountInWei, [_tokenIn.address, _tokenOut.address]).call();
                    let amountOut = Util.amountFromBlockchain(amountsOutWei[1], _tokenOut.decimals);
                    //inform if it is in the second try and so forth
                    if(parseInt(shot) > 0){
                        console.log(`##### amount out got it in SHOT ${parseInt(shot)+1} #####`);
                    }
                    resolve(amountOut);
                    break;
                } catch (error) {
                    
                    //alchemy error code for exceeding units per second capacity. 
                    if (Util.isAlchemyExceedingError(error)){                                            
                        let waitTimeInMs = Util.getAlchemyWaitingTime();
                        console.log(`##### trying to get token0 again in ${Number(waitTimeInMs).toFixed(2)} ms... #####`);
                        await Util.sleep(waitTimeInMs);
                    } else {
                        console.log(`### error on query UniswapV2 ${_tokenIn.address} ${_tokenOut.address} error: ${error} ### `)
                        reject(0.0);
                        break
                    }
                }
            }
        });
        return txPromise;  
    } 

    /**
     * Try to get reserves 6 times by default to avoid 429 error on alchemy
     * @param {*} _contract 
     * @returns 
     */
     async queryReserves (_pairABI, _pairAddress, _times = 6){
        let contract = new this.GLOBAL.web3Instance.eth.Contract(_pairABI, _pairAddress);
        let callReservesPromise = new Promise (async (resolve, reject) =>{  
            let totalTimes = new Array(_times).fill(1);
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
                    if ( Util.isAlchemyExceedingError(error)){
                                            
                        let waitTimeInMs = Util.getAlchemyWaitingTime();
                        console.log(`##### trying to get reserves again in ${Number(waitTimeInMs).toFixed(2)} ms... #####`);
                        await Util.sleep(waitTimeInMs);
                    } else {
                        reject([0,0]);
                        break;
                    }
                }
            }
        });
        return callReservesPromise;
    }


    /**
     * Try to get first token from contract 6 times by default to avoid 429 error on alchemy
     * @param {*} _contract 
     * @returns 
     */
    async queryFirstTokenFromContract (_pairABI, _pairAddress, _times = 6){
        let contract = new this.GLOBAL.web3Instance.eth.Contract(_pairABI, _pairAddress);
        let queryPromise = new Promise (async (resolve, reject) =>{            
            let totalTimes = new Array(_times).fill(1);
            for (let shot in totalTimes){
                try {
                    let token0 = await contract.methods.token0().call();
                    //inform if it is in the second try and so forth
                    if(parseInt(shot) > 0){
                        console.log(`##### token0 got it in SHOT ${parseInt(shot)+1} #####`);
                    }
                    resolve(token0);
                    break;
                } catch (error) {
                    //alchemy error code for exceeding units per second capacity. (sometimes alchemy returns undefined as error.code)
                    if ( Util.isAlchemyExceedingError(error)){                        
                        let waitTimeInMs = Util.getAlchemyWaitingTime();
                        console.log(`##### trying to get token0 again in ${Number(waitTimeInMs).toFixed(2)} ms... #####`);
                        await Util.sleep(waitTimeInMs);
                    } else {
                        reject(error);
                        break;
                    }
                }
            }
        });
        return queryPromise;
    }

    /**
     * Try to liquidity pool conntract address 6 times by default to avoid 429 error on alchemy
     * @param {*} _contract 
     * @returns 
     */
     async queryLiquidityPoolAddress (_DEX, _tokenIn, _tokenOut, _times = 6){
        let contractFactory = new this.GLOBAL.web3Instance.eth.Contract(_DEX.factoryABI, _DEX.factoryContractAddress);
        let queryPromise = new Promise (async (resolve, reject) =>{            
            let totalTimes = new Array(_times).fill(1);
            for (let shot in totalTimes){
                try {
                    let pairAddress = await contractFactory.methods.getPair(_tokenIn.address, _tokenOut.address).call();
                    //inform if it is in the second try and so forth
                    if(parseInt(shot) > 0){
                        console.log(`##### pair address got it in SHOT ${parseInt(shot)+1} #####`);
                    }
                    resolve(pairAddress);
                    break;
                } catch (error) {
                    //alchemy error code for exceeding units per second capacity. (sometimes alchemy returns undefined as error.code)
                    if ( Util.isAlchemyExceedingError(error)){                        
                        let waitTimeInMs = Util.getAlchemyWaitingTime();
                        console.log(`##### trying to get pair address again in ${Number(waitTimeInMs).toFixed(2)} ms... #####`);
                        await Util.sleep(waitTimeInMs);
                    } else {
                        reject(error);
                        break;
                    }
                }
            }
        });
        return queryPromise;
    }


}

module.exports = UniswapV2ops;