/**
 * used to interact with the Flashloaner smart contract
 * @author matheus rosendo
 */

const {BlockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
const Util = require("./Util.js");
const assert = require('assert');
const Flashloan = require("./build/contracts/Flashloaner");
const ERC20ops = require("./ERC20ops.js");
const Web3 = require('web3');

class FlashloanerOps {
    
    constructor (_GLOBAL){
        this.loggerBalanceEventABI = [ {type: 'uint256', name: 'oldBalance'}, {type: 'uint256', name: 'newBalance'} ];
        this.GLOBAL = _GLOBAL;
        let flashloanerAddress = Flashloan.networks[this.GLOBAL.networkId].address;
        //it uses the FLASHLOANER address set in .env file, if it is set, else uses the local deployed contract 
        if(this.GLOBAL.flashloanerDeployedAddressMainnet){
            flashloanerAddress = this.GLOBAL.flashloanerDeployedAddressMainnet;
        }
        this.contractInstance = new this.GLOBAL.web3Instance.eth.Contract(Flashloan.abi, flashloanerAddress, { from: this.GLOBAL.ownerAddress })
    }

    /**
     * Withdraw all balance of informed _token 
     * @param {*} _amount 
     * @returns transaction (Promise)
     */
    async withdrawToken(_token){
        Util.assertValidInputs([_token], "withdrawToken");

        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {            
                            
                //encode withdraw method 
                let dataWithdraw = this.contractInstance.methods.withdraw(_token.address).encodeABI(); 
            
                //declare raw tx to withdraw
                let rawWithdrawTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: this.contractInstance._address,
                    maxFeePerGas: BlockchainConfig.blockchain[this.GLOBAL.blockchain].MAX_FEE_PER_GAS,
                    maxPriorityFeePerGas: BlockchainConfig.blockchain[this.GLOBAL.blockchain].MAX_PRIORITY_FEE_PER_GAS,
                    gasLimit: BlockchainConfig.blockchain[this.GLOBAL.blockchain].GAS_LIMIT_LOW,
                    data: dataWithdraw
                };

                //sign tx
                let signedWithdrawTx = await this.GLOBAL.web3Instance.eth.accounts.signTransaction(rawWithdrawTx, this.GLOBAL.ownerPK);  
                
                //send signed transaction
                let withdrawTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedWithdrawTx.raw || signedWithdrawTx.rawTransaction);
                withdrawTx.on("receipt", (receipt) => {
                    console.log(`### ${_token.symbol} withdrawn successfully: ###`);  
                    console.log(`### tx: ${receipt.transactionHash} ###`);                                          
                    resolve(receipt);
                });
                withdrawTx.on("error", (err) => {
                    console.log("### withdrawn tx error: ###");
                    reject(err);
                }); 

            } catch (error) {
                reject(error);
            }
        });
        return txPromise;  
    }


    /**
     * query chain id contained in the storage variable chainId of the contract 
     * @param {*} _amount 
     * @returns chainId (Number)
     */
     async getChainId(){        
        try {            
            let chainId = await this.contractInstance.methods.getChainId().call();
            return chainId;            
        } catch (error) {
            throw new Error(error);
        }
    }

    /**
     * query owner of the contract 
     * @param {*} _amount 
     * @returns address owner (String)
     */
     async getOwner(){        
        try {            
            let owner = await this.contractInstance.methods.owner().call();
            return owner;            
        } catch (error) {
            throw new Error(error);
        }
    }

   
    /**
     * Executes flashloan 
     * @param {*} _parsedJson input flashloan data
     * @returns transaction (Promise)
     */
    executeFlashloan (_parsedJson){
        Util.assertValidInputs([_parsedJson], "executeFlashloan");
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
                
            
                //declare raw tx 
                let rawFlashloanTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: this.contractInstance._address,
                    maxFeePerGas: BlockchainConfig.blockchain[this.GLOBAL.blockchain].MAX_FEE_PER_GAS,
                    maxPriorityFeePerGas: BlockchainConfig.blockchain[this.GLOBAL.blockchain].MAX_PRIORITY_FEE_PER_GAS * 2, //double tip to miners to put transaction in priority
                    gasLimit: BlockchainConfig.blockchain[this.GLOBAL.blockchain].GAS_LIMIT_HIGH,
                    data: encodedMethod
                };

                //sign tx
                let signedFlashloanTx = await this.GLOBAL.web3Instance.eth.accounts.signTransaction(rawFlashloanTx, this.GLOBAL.ownerPK);  
                
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

    /**
     * Verifies input flashloan data
     * @param {*} _parsedJson 
     * @returns Object 
     */
    isInputFileOk(_parsedJson){
        let isOk = true;
        let message = "Verified";
        if(!_parsedJson.initialTokenAmount){
            message = "field initialTokenAmount not found in input file";
            return {isOk: false, message: message};
        }
        if(!_parsedJson.initialTokenDecimals){
            message = "field initialTokenDecimals not found in input file";
            return {isOk: false, message: message};
        }        
        if(!_parsedJson.flashloanInputData){
            message = "field flashloanInputData not found in input file";
            return {isOk: false, message: message};
        }
        if(!_parsedJson.flashloanInputData.flashLoanSource){
            message = "field flashLoanSource not found in input file";
            return {isOk: false, message: message};
        }
        if(!_parsedJson.flashloanInputData.flashLoanPool){
            message = "field flashLoanPool not found in input file";
            return {isOk: false, message: message};
        }
        if(!_parsedJson.flashloanInputData.swaps){
            message = "field _parsedJson.flashloanInputData.swaps not found in input file";
            return {isOk: false, message: message};
        }
        if(_parsedJson.flashloanInputData.swaps.length == 0){
            message = "at least one swap must be in the flashloanInputData.swaps list in input file";
            return {isOk: false, message: message};
        }
        //vefify fees addressesss 
        for (let swap of _parsedJson.flashloanInputData.swaps){
            if (!this.GLOBAL.web3Instance.utils.isAddress(swap.routerAddress)){
                message = "invalid address found: routerAddress";
                return {isOk: false, message: message};
            }
            if (!this.GLOBAL.web3Instance.utils.isAddress(swap.tokenInAddress)){
                message = "invalid address found: tokenInAddress";
                return {isOk: false, message: message};
            }
            if (!this.GLOBAL.web3Instance.utils.isAddress(swap.tokenOutAddress)){
                message = "invalid address found: tokenOutAddress";
                return {isOk: false, message: message};
            }
            if(!swap.fee){
                message = "invalid fee found";
                return {isOk: false, message: message};
            }
        }
        return {isOk: true, message: message};
    }
    
}

module.exports = FlashloanerOps;