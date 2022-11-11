const {BlockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
const Util = require("./Util.js");
const assert = require('assert');

class ERC20ops {
    
    constructor (_GLOBAL){
        this.GLOBAL = _GLOBAL;
        //singleton contracts array
        this.contracts = new Array();
    }

    /**
     * Singleton, creates a new web3 instance of a given ERC20 contract if it does not exist yet
     * @param {*} _erc20 
     * @returns 
     */
    getERC20instance(_token){
        try { 
            assert(_token.address, "Error: undefined token address!");
            if(this.contracts[_token.symbol] == undefined){
                let contract = new this.GLOBAL.web3Instance.eth.Contract(_token.ABI, _token.address, { from: this.GLOBAL.ownerAddress });
                this.contracts[_token.symbol] = contract;
            }            
            return this.contracts[_token.symbol];        
        } catch (error) {
            throw new Error(error);
        }
    }

    async transfer(_erc20, _to, _amount){
        
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {            
                            
                //instanctiate erc20 contract
                let contract = this.getERC20instance(_erc20);

                //verify current balance
                let currentTokenBalance = await this.getBalanceOfERC20(_erc20, this.GLOBAL.ownerAddress);
                assert(currentTokenBalance >= _amount, `Error: insuficient amount of ${_erc20.symbol}: ${currentTokenBalance} `);
                assert(_amount > 0, `Error: amount = 0 `); 
               
                //encode transfer method 
                let dataTransfer = contract.methods.transfer(_to, Util.amountToBlockchain(_amount, _erc20.decimals)).encodeABI(); 
            
                //declare raw tx to transfer
                let rawTransferTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: contract._address,
                    maxFeePerGas: 100000000000,
                    data: dataTransfer
                };

                //sign tx
                let signedTransferTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawTransferTx, this.GLOBAL.ownerAddress);  
                
                //send signed transaction
                let transferTx = await this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedTransferTx.raw || signedTransferTx.rawTransaction);
                console.log(`### ${_amount} ${_erc20.symbol} transfered successfully: ###`);   
                console.log(`### tx: ${transferTx.transactionHash} ###`);       
                resolve(transferTx);

            } catch (error) {
                reject(new Error(error));
            }
        });
        return txPromise;  
    }

    async getBalanceOfERC20(_token, _address){
        try {
            let erc20contract = await this.getERC20instance(_token);
            if(erc20contract === undefined){
                throw ("Error trying to get ERC20instance")
            }
            let balanceInWei = await erc20contract.methods.balanceOf(_address).call();
            let decimals = _token.decimals;
            if(decimals === undefined){
                throw ("Error tryng to get decimals of token on BlockchainConfig file");
            }
            if(balanceInWei > 0){
                return Util.amountFromBlockchain(balanceInWei, decimals);
            } else {
                return 0;
            }
            
        } catch (error) {
            throw new Error(error);
        }
    }

    /**
     * Converts WETH back to ETH
     * @param {*} _amount 
     * @returns 
     */
    async withdrawEthfromWeth(_amount){
        
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {            
                            
                //instanctiate erc20 contract
                let tokenWeth = getItemFromTokenList("symbol", "WETH", this.GLOBAL.tokenList);
                let wethContract = this.getERC20instance(tokenWeth);
                
                //approve erc20 contract
                await this.approve(tokenWeth, wethContract._address, _amount);

                //encode withdraw method 
                let dataWithdraw = wethContract.methods.withdraw(Util.amountToBlockchain(_amount)).encodeABI(); 
            
                //declare raw tx to withdraw
                let rawWithdrawTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: wethContract._address,
                    maxFeePerGas: 100000000000,
                    data: dataWithdraw
                };

                //sign tx
                let signedWithdrawTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawWithdrawTx, this.GLOBAL.ownerAddress);  
                
                //send signed transaction
                let withdrawTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedWithdrawTx.raw || signedWithdrawTx.rawTransaction);
                withdrawTx.on("receipt", (receipt) => {
                    console.log(`### ${_amount} ETH withdrawn successfully: ###`);   
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

    /**
     * Approve ERC20 contract to spend the given amount
     * @param {*} _amount 
     * @returns 
     */
     async approve(_token, _spender, _amount){
        
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {  
                let contractInstance = await this.getERC20instance(_token);
                let dataApprove = contractInstance.methods.approve(_spender, Util.amountToBlockchain(_amount, _token.decimals)).encodeABI(); 
                
                //declare raw tx to approve
                let rawApproveTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: contractInstance._address,
                    maxFeePerGas: 100000000000,
                    data: dataApprove
                };

                //sign tx
                let signedApproveTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawApproveTx, this.GLOBAL.ownerAddress);                
                
                //send signed transaction
                let approveTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedApproveTx.raw || signedApproveTx.rawTransaction);
                approveTx.on("receipt", async (receipt) => {
                    console.log("### amount approved successfully: ###"); 
                    console.log(`### tx: ${receipt.transactionHash} ###`);   
                    resolve(receipt);          
                });
                approveTx.on("error", (err) => {
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

module.exports = ERC20ops;