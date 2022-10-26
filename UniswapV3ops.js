const {blockchainConfig, erc20list} = require("./BlockchainConfig.js");
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
                let tokenIn = blockchainConfig.blockchain[this.GLOBAL.blockchain].WETH9_ADDRESS;
                let tokenOut = blockchainConfig.blockchain[this.GLOBAL.blockchain].DAI_ADDRESS;
                let fee = 3000;
                let amountInWei = Util.amountToBlockchain(_amount);

                //aprove swap
                let erc20ops = new ERC20ops(this.GLOBAL);
                await erc20ops.approve(erc20list.WETH, swapRouterAddress, _amount);

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