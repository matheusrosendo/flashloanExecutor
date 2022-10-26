const {blockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
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
                let swapRouterAddress = blockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_ROUTER_ADDRESS;
                let swapRouterContract = new this.GLOBAL.web3Instance.eth.Contract(blockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_ROUTER_ABI, swapRouterAddress, { from: this.GLOBAL.ownerAddress });
                
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
                let swapFactoryAddress = blockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_FACTORY_ADDRESS;
                let swapFactoryContract = new this.GLOBAL.web3Instance.eth.Contract(blockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_FACTORY_ABI, swapFactoryAddress, { from: this.GLOBAL.ownerAddress });
                
                let address = await swapFactoryContract.methods.getPool(_tokenIn.address, _tokenOut.address, _fee).call();
                resolve(address);
            } catch (error) {
                reject(new Error(error));
            }
        });
        return txPromise;  
    } 

    async showPoolAddress(_tokenIn, _tokenOut, _fee){
        try {
            let address = await this.getPoolAddress(_tokenIn, _tokenOut, _fee);
            console.log(`${_tokenIn.symbol} <> ${_tokenOut.symbol} %${Number(_fee/(10000).toFixed(2))} fee | ${blockchainConfig.blockchain[this.GLOBAL.blockchain].EXPLORER}${address}`);
        } catch (error) {
            throw new Error(error);
        }
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
                let swapRouterAddress = blockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_ROUTER_ADDRESS;
                let swapRouterContract = new this.GLOBAL.web3Instance.eth.Contract(blockchainConfig.blockchain[this.GLOBAL.blockchain].UNISWAPV3_ROUTER_ABI, swapRouterAddress, { from: this.GLOBAL.ownerAddress });
                
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