const {BlockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
const Util = require("./Util.js");
const assert = require('assert');
const Flashloan = require("./build/contracts/Flashloaner");
const ERC20ops = require("./ERC20ops.js");
const Web3 = require('web3');

class FlashloanerOps {
    
    constructor (_GLOBAL, _contractAddress){
        this.loggerBalanceEventABI = [ {type: 'uint256', name: 'oldBalance'}, {type: 'uint256', name: 'newBalance'} ];
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
                    maxFeePerGas: 100000000000,
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

   

    executeFlashloan (_parsedJson){
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {            
                console.log(`### Executing flashloan on ${_parsedJson.flashloanInputData.flashLoanSource} NEW INPUT | $${Number(_parsedJson.initialAmountInUSD).toFixed(2)} => ${JSON.stringify(_parsedJson.route)}  ###`); 
                let amountToBorrowOfFirstToken = Util.amountToBlockchain(_parsedJson.initialTokenAmount, _parsedJson.initialTokenDecimals);

                //include amount on input data
                _parsedJson.flashloanInputData.loanAmount = amountToBorrowOfFirstToken;
                
                //encode method 
                let encodedMethod
                if(_parsedJson.flashloanInputData.flashLoanSource == "Dodo"){
                    encodedMethod = this.contractInstance.methods.flashloanDodo(_parsedJson.flashloanInputData).encodeABI(); 
                } else if(_parsedJson.flashloanInputData.flashLoanSource == "Aave"){
                    encodedMethod = this.contractInstance.methods.flashloanAave(_parsedJson.flashloanInputData).encodeABI(); 
                } else {
                    reject("Invalid flashloan souce on flashloanInputData!");
                }
                
            
                //declare raw tx to withdraw
                let rawFlashloanTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: this.contractInstance._address,
                    maxFeePerGas: 100000000000,
                    gasLimit: 10_000_000,
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
                    console.log(`### !!! Flashloan executed !!! ###`); 
                })
                .on('confirmation', function(confirmationNumber, receipt){ 
                    console.log(`### Confirmation number: ${confirmationNumber} ###`);  
                    receipt.flashloanProtocol = _parsedJson.flashloanInputData.flashLoanSource;
                    receipt.status = "confirmed";
                    receipt.details = "Ok"
                    resolve(receipt);
                 })
                .on('error', function(error) {
                    console.log(`### No profit found: ###`);  
                    
                    if (error.receipt){
                        error.receipt.flashloanProtocol = _parsedJson.flashloanInputData.flashLoanSource;
                        error.receipt.status = "failed";
                        let details = "";
                        if(error.reason){
                            details += error.reason + " \n";
                        }
                        if(error.message){
                            details += error.message;
                        }
                        error.receipt.details = details;
                        reject(error.receipt);
                    } else {
                        reject({status: "failed"});
                    }
                    
                });

            } catch (error) {
                reject(error);
            }
        });
        return txPromise;  
    }

    
    isInputFileOk(_parsedJson){
        let fileOk = true;
        if(!_parsedJson.initialTokenAmount){
            throw new Error("field initialTokenAmount not found in input file");
        }
        if(!_parsedJson.initialTokenDecimals){
            throw new Error("field initialTokenDecimals not found in input file");
        }        
        if(!_parsedJson.flashloanInputData){
            throw new Error("field flashloanInputData not found in input file");
        }
        if(!_parsedJson.flashloanInputData.flashLoanSource){
            throw new Error("field flashLoanSource not found in input file");
        }
        if(!_parsedJson.flashloanInputData.flashLoanPool){
            throw new Error("field flashLoanPool not found in input file");
        }
        if(!_parsedJson.flashloanInputData.swaps){
            throw new Error("field _parsedJson.flashloanInputData.swaps not found in input file");
        }
        if(_parsedJson.flashloanInputData.swaps.length == 0){
            throw new Error("at least one swap must be in the flashloanInputData.swaps list in input file");
        }
        //vefify fees addressesss 
        for (let swap of _parsedJson.flashloanInputData.swaps){
            if (!this.GLOBAL.web3Instance.utils.isAddress(swap.routerAddress)){
                throw new Error("invalid address found: routerAddress");
            }
            if (!this.GLOBAL.web3Instance.utils.isAddress(swap.tokenInAddress)){
                throw new Error("invalid address found: tokenInAddress");
            }
            if (!this.GLOBAL.web3Instance.utils.isAddress(swap.tokenOutAddress)){
                throw new Error("invalid address found: tokenOutAddress");
            }
            if(!swap.fee){
                throw new Error("invalid fee found");
            }
        }
        return fileOk;
    }
    
}

module.exports = FlashloanerOps;