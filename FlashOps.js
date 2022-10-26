const {blockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
const Util = require("./Util.js");
const assert = require('assert');
const Flashloan = require("./build/contracts/FlashloanExecutor");
const ERC20ops = require("./ERC20ops.js");

class FlashOps {
    
    constructor (_GLOBAL, _contractAddress){
        this.GLOBAL = _GLOBAL;
        this.contractInstance = new this.GLOBAL.web3Instance.eth.Contract(Flashloan.abi, Flashloan.networks[this.GLOBAL.networkId].address, { from: this.GLOBAL.ownerAddress })
    }

    /**
     * withdraw all ETH from contract
     * @param {*} _amount 
     * @returns 
     */
    async withdrawToken(_token){
        
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {            
                            
                //encode withdraw method 
                let dataWithdraw = this.contractInstance.methods.withdraw(_token.address).encodeABI(); 
            
                //declare raw tx to withdraw
                let rawWithdrawTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: this.contractInstance._address,
                    maxFeePerGas: 10000000000,
                    data: dataWithdraw
                };

                //sign tx
                let signedWithdrawTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawWithdrawTx, this.GLOBAL.ownerAddress);  
                
                //send signed transaction
                let withdrawTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedWithdrawTx.raw || signedWithdrawTx.rawTransaction);
                withdrawTx.on("receipt", (receipt) => {
                    console.log(`### ${_token.symbol} withdrawn successfully: ###`);  
                    console.log(`### tx: ${receipt.transactionHash} ###`);                                          
                    resolve(receipt);
                });
                withdrawTx.on("error", (err) => {
                    console.log("### approve tx error: ###");
                    reject(new Error(err));
                }); 

            } catch (error) {
                reject(new Error(error));
            }
        });
        return txPromise;  
    }
}

module.exports = FlashOps;