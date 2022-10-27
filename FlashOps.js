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
     * withdraw all balance of a Token 
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

    async executeFlashloanAAVEv1 (_parsedJson){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {            
                
                let amountToBorrowOfFirstToken = Util.amountToBlockchain(_parsedJson.initialTokenAmount, _parsedJson.initialTokenDecimals);

                //encode method 
                let encodedMethod = this.contractInstance.methods.flashloanAAVEv1(amountToBorrowOfFirstToken, _parsedJson.addressPath).encodeABI(); 
            
                //declare raw tx to withdraw
                let rawFlashloanTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: this.contractInstance._address,
                    maxFeePerGas: 10000000000,
                    gasLimit: 10000000,
                    data: encodedMethod
                };

                //sign tx
                let signedFlashloanTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawFlashloanTx, this.GLOBAL.ownerAddress);  
                
                //send signed transaction
                this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedFlashloanTx.raw || signedFlashloanTx.rawTransaction)
                .on('transactionHash', function(hash){                     
                    console.log(`### tx: ${hash} ###`); 
                })
                .on('receipt', function(receipt){
                    console.log(`### flashloan executed! ###`); 
                })
                .on('confirmation', function(confirmationNumber, receipt){ 
                    console.log(`### Confirmation number: ${confirmationNumber} ###`);  
                    resolve(receipt);
                 })
                .on('error', function(error) {
                    throw(error);
                });

            } catch (error) {
                reject(new Error(error));
            }
        });
        return txPromise;  
    }
}

module.exports = FlashOps;