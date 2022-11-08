const {BlockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
const Util = require("./Util.js");
const ERC20ops = require("./ERC20ops.js");

class UniswapV3ops {
    constructor (_GLOBAL){
        this.GLOBAL = _GLOBAL;
    }

    getNetwork(){
        return this.GLOBAL.network;
    }

    async exchangeWETHbyDAI(_amount, _owner){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {            
                //instanciate router contract
                let swapRouterAddress = BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_ROUTER_ADDRESS;
                let swapRouterContract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_ROUTER_ABI, swapRouterAddress, { from: this.GLOBAL.ownerAddress });
                
                //extract params
                let tokenIn = getItemFromTokenList("symbol", "WETH", this.GLOBAL.tokenList).address;
                let tokenOut = getItemFromTokenList("symbol", "DAI", this.GLOBAL.tokenList).address;
                let fee = 3000;
                let amountInWei = Util.amountToBlockchain(_amount);

                //aprove swap
                let erc20ops = new ERC20ops(this.GLOBAL);
                await erc20ops.approve(getItemFromTokenList("symbol", "WETH", this.GLOBAL.tokenList), swapRouterAddress, _amount);

                //define params
                const swapParams = {
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: fee,
                    recipient: this.GLOBAL.ownerAddress,
                    deadline: Math.floor(Date.now() / 1000) + (60 * 10),
                    amountIn: amountInWei,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0,
                }
               
                //encode method 
                let dataSwap = swapRouterContract.methods.exactInputSingle(swapParams).encodeABI(); 
                    
                //declare raw tx to withdraw
                let rawSwapTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: swapRouterAddress,
                    maxFeePerGas: 10000000000,
                    data: dataSwap
                };

                //sign tx
                let signedWithdrawTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawSwapTx, this.GLOBAL.ownerAddress);  
                
                //send signed transaction
                let withdrawTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedWithdrawTx.raw || signedWithdrawTx.rawTransaction);
                withdrawTx.on("receipt", (receipt) => {
                    console.log(`### ${_amount} WETH exchanged by DAI successfully: ###`);  
                    console.log(`### tx: ${receipt.transactionHash} ###`);                                          
                    resolve(receipt);
                });
                withdrawTx.on("error", (err) => {
                    console.log("### Exchange tx error: ###");
                    reject(new Error(err));
                }); 

            } catch (error) {
                reject(new Error(error));
            }
        });
        return txPromise;  
    } 

    
     async getPoolAddress(_tokenIn, _tokenOut, _fee){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {  
                let feeBip = _fee * (10**4);          
                let swapFactoryAddress = BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_FACTORY_ADDRESS;
                let swapFactoryContract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_FACTORY_ABI, swapFactoryAddress, { from: this.GLOBAL.ownerAddress });
                
                let address = await swapFactoryContract.methods.getPool(_tokenIn.address, _tokenOut.address, feeBip).call();
                resolve(address);
            } catch (error) {
                reject(error);
            }
        });
        return txPromise;  
    } 

    async queryAmountOut(_amountIn, _tokenIn, _tokenOut, _fee){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {    
                let feeBip = _fee * (10**4); 
                let amountInWei = Util.amountToBlockchain(_amountIn, _tokenIn.decimals);   
                let quoterAddress = BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_QUOTER_ADDRESS;
                let quoterContract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_QUOTER_ABI, quoterAddress, { from: this.GLOBAL.ownerAddress });
                
                let amountOutWei = await quoterContract.methods.quoteExactInputSingle(_tokenIn.address, _tokenOut.address, feeBip, amountInWei, 0).call();
                let amountOut = Util.amountFromBlockchain(amountOutWei, _tokenOut.decimals);
                resolve(amountOut);
            } catch (error) {
                reject(error);
            }
        });
        return txPromise;  
    } 

    async getToken0AddressFromPool(_poolAddress){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {   
                let poolV3Abi = BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_POOL;         
                let poolContract = new this.GLOBAL.web3Instance.eth.Contract(poolV3Abi, _poolAddress, { from: this.GLOBAL.ownerAddress });                
                let token0address = await poolContract.methods.token0().call();
                resolve(token0address);
            } catch (error) {
                reject(new Error(error));
            }
        });
        return txPromise;  
    }

    async getAmountOut(_amount, _tokenIn, _tokenOut, _fee){
        let feeBip = _fee * (10**4);
        console.log(`feeBip ${feeBip}`);
        try {
                    
            let poolAddress = await this.getPoolAddress(_tokenIn, _tokenOut, feeBip);
            if(poolAddress){
                console.log(`poolAddress: ${poolAddress}`);
                let token0address = await this.getToken0AddressFromPool(poolAddress);
                console.log(`token0address: ${token0address}`);
                let slot0 = await this.getSlot0FromPool(poolAddress);
                let P = ( (slot0.sqrtPriceX96) / (2 ** 96) ) ** 2;
                console.log(`P: ${P}`)
                console.log(`tick: ${slot0.tick}`)
                console.log(`1.0001**tick: ${1.0001 ** slot0.tick}`)
                if(_tokenIn.address == token0address){
                    P = 1 / P;
                } 
                let amountOut = ((_amount * (10 ** _tokenIn.decimals)) / (P * (10 ** _tokenOut.decimals))) ;
                let amountFee = amountOut * (_fee/100);
                console.log(`amountFee ${amountFee}`);
                return amountOut - amountFee;
            } else {
                console.log("pool not found for informed tokens and feeBip ")
            }
        } catch (error) {
            throw (error);
        }
    }

    async showPoolAddress(_tokenIn, _tokenOut, _fee){
        try {
            
            let address = await this.getPoolAddress(_tokenIn, _tokenOut, _fee);
            console.log(`${_tokenIn.symbol} <> ${_tokenOut.symbol} %${Number(_fee).toFixed(4)} fee | ${BlockchainConfig.blockchain[this.GLOBAL.blockchain].EXPLORER}${address}`);
        } catch (error) {
            throw new Error(error);
        }
    }

    
    /**
     * execute query if blacklist not informed or the set {_tokenIn, _tokenOut, fee} is not contained in blacklist
     * if blacklist is informed, it will be updated for each invalid / unexistent set {_tokenIn, _tokenOut, fee}  
     * @param {*} _amountIn 
     * @param {*} _tokenIn 
     * @param {*} _tokenOut 
     * @param {*} _blacklist 
     * @returns best fee of uniswap v3 route between tokenIn and tokenOut
     */
    async queryFeeOfBestRoute(_amountIn, _tokenIn, _tokenOut, _blacklist){
        try {
            let possibleFees = BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_FEES;
            let bestFee = 0;
            let bestAmountOut = 0;
            for (let fee of possibleFees){
                let executeQuery = true;
                if(_blacklist && Util.isBlacklistedUniswapV3(_blacklist, _tokenIn, _tokenOut, fee)){
                    executeQuery = false;
                }
                if(executeQuery){
                    try {
                                                
                        let currentAmountOut = await this.queryAmountOut(_amountIn, _tokenIn, _tokenOut, fee);
                        if(currentAmountOut > bestAmountOut){
                            bestAmountOut = currentAmountOut;
                            bestFee = fee;
                        }
                    } catch (error) {//in case of error getting amount out adds it in the blacklist and continues
                        if(_blacklist){
                            _blacklist = Util.addToBlacklistUniswapV3(_blacklist, _tokenIn.symbol, _tokenOut.symbol, fee);
                        }  
                    }
                    
                }                               
            } 
            return {bestFee: bestFee, updatedBlacklist: _blacklist};          
        } catch (error) {
            throw new Error(error);
        }
    }

    async getSlot0FromPool(_poolAddress){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {      
                let poolV3Abi = BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_POOL;
                let poolContract = new this.GLOBAL.web3Instance.eth.Contract(poolV3Abi, _poolAddress, { from: this.GLOBAL.ownerAddress });
                
                let slot0 = await poolContract.methods.slot0().call();
                resolve(slot0);
            } catch (error) {
                reject(new Error(error));
            }
        });
        return txPromise;  
    } 

    /**
     * Realize swap between two tokens
     * @param {*} _amount 
     * @param {*} _tokenIn 
     * @param {*} _tokenOut 
     * @param {*} _fee 500, 1000 or 3000 => 0.05%, 0.1%, 0.3%
     * @returns 
     */
    async swap(_amount, _tokenIn, _tokenOut, _fee){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try { 
                //vefifies if poolAddress exists
                let poolAddress = await this.getPoolAddress(_tokenIn, _tokenOut, _fee);
                if(!poolAddress || poolAddress == "0x0000000000000000000000000000000000000000"){
                    await this.showPoolAddress(_tokenIn, _tokenOut, _fee);
                    throw new Error("Pool address not found")
                }           
                //instanciate router and factory contracts
                let swapRouterAddress = BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_ROUTER_ADDRESS;
                let swapRouterContract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_ROUTER_ABI, swapRouterAddress, { from: this.GLOBAL.ownerAddress });
                
                //extract params
                let tokenIn = _tokenIn.address;
                let tokenOut = _tokenOut.address;
                let fee = _fee;
                let amountInWei = Util.amountToBlockchain(_amount);

                //aprove swap
                let erc20ops = new ERC20ops(this.GLOBAL);
                await erc20ops.approve(_tokenIn, swapRouterAddress, _amount);

                //define params
                const swapParams = {
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: fee,
                    recipient: this.GLOBAL.ownerAddress,
                    deadline: Math.floor(Date.now() / 1000) + (60 * 10),
                    amountIn: amountInWei,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0,
                }
               
                //encode method 
                let dataSwap = swapRouterContract.methods.exactInputSingle(swapParams).encodeABI(); 
                    
                //declare raw tx to withdraw
                let rawSwapTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: swapRouterAddress,
                    maxFeePerGas: 10000000000,
                    data: dataSwap
                };

                //sign tx
                let signedWithdrawTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawSwapTx, this.GLOBAL.ownerAddress);  
                
                //send signed transaction
                let withdrawTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedWithdrawTx.raw || signedWithdrawTx.rawTransaction);
                withdrawTx.on("receipt", (receipt) => {
                    console.log(`### ${_amount} ${_tokenIn.symbol} exchanged by ${_tokenOut.symbol} successfully: ###`);  
                    console.log(`### tx: ${receipt.transactionHash} ###`);                                         
                    resolve(receipt);
                });
                withdrawTx.on("error", (err) => {
                    console.log("### Exchange tx error: ###");
                    reject(new Error(err));
                }); 

            } catch (error) {
                reject(new Error(error));
            }
        });
        return txPromise;  
    } 

}

module.exports = UniswapV3ops;