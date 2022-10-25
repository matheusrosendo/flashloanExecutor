const {blockchainConfig, erc20list} = require("./BlockchainConfig.js");
const Util = require("./Util.js");

class UniswapV3ops {
    constructor (_GLOBAL){
        this.GLOBAL = _GLOBAL;
    }

    getNetwork(){
        return this.GLOBAL.network;
    }

    exchangeWETHbyDAI(_amount, _owner){
        let tokenIn = blockchainConfig.blockchain[blockchain].WETH_ADDRESS;
        let tokenOut = blockchainConfig.blockchain[blockchain].DAI_ADDRESS;
        let fee = 3000;
        let amountInWei = Util.amountToBlockchain(_amount);

        const params = {
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: WALLET_ADDRESS,
            deadline: Math.floor(Date.now() / 1000) + (60 * 10),
            amountIn: amountInWei,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
          }
        
    } 

}

module.exports = UniswapV3ops;