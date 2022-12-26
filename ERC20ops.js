/**
 * used to interact with ERC20 smart contracts
 * @author Matheus Rosendo
 */

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
     * @returns ERC20 contract instance
     */
    getERC20singleton(_token){
        try { 
            assert(_token.address, "Error: undefined token address!");
            if(this.contracts[_token.symbol] == undefined){

                //verify if an ABI property exists, otherwise get a generic ABI from blockchainConfig
                let tokenAbi;
                if(_token.ABI){
                    tokenAbi = _token.ABI
                }else{
                    tokenAbi = BlockchainConfig.blockchain[this.GLOBAL.blockchain].ERC20_GENERIC_ABI;
                }
                let contract = new this.GLOBAL.web3Instance.eth.Contract(tokenAbi, _token.address, { from: this.GLOBAL.ownerAddress });
                this.contracts[_token.symbol] = contract;
            }            
            return this.contracts[_token.symbol];        
        } catch (error) {
            throw new Error(error);
        }
    }

    /**
     * create a new instance of the given token address
     * @param {*} _tokenAddress 
     * @returns ERC20 Contract Instance
     */
    createERC20instance(_tokenAddress){
        try { 
            assert(_tokenAddress, "Error: undefined token address!");
            let contract = new this.GLOBAL.web3Instance.eth.Contract(BlockchainConfig.blockchain[this.GLOBAL.blockchain].ERC20_GENERIC_ABI, _tokenAddress, { from: this.GLOBAL.ownerAddress });
            return contract;      
        } catch (error) {
            throw new Error(error);
        }
    }

    /**
     * transfer funds from ownerAddress to given _to address
     * @param {*} _erc20 
     * @param {*} _to 
     * @param {*} _amount 
     * @returns transaction (Promise)
     */
    async transfer(_erc20, _to, _amount){
        Util.assertValidInputs([_erc20, _to, _amount], "transfer");
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {            
                            
                //instanctiate erc20 contract
                let contract = this.getERC20singleton(_erc20);

                //verify current balance
                let currentTokenBalance = await this.getBalanceOfERC20(_erc20, this.GLOBAL.ownerAddress);
                assert(currentTokenBalance >= _amount, `Error: insuficient amount of ${_erc20.symbol}: ${currentTokenBalance} `);
                assert(_amount > 0, `Error: amount = 0 `); 
               
                //encode transfer method 
                let dataTransfer = contract.methods.transfer(_to, Util.amountToBlockchain(_amount, _erc20.decimals)).encodeABI(); 
                
                //sets maxFeePerGas and maxPriorityFeePerGas, lesser values were generating 'transaction underpriced' error on Polygon mainnet 
                let maxPriorityFeePerGas = await this.GLOBAL.web3Instance.eth.getGasPrice();
                let maxFeePerGas = maxPriorityFeePerGas * 3;

                //declare raw tx to transfer
                let rawTransferTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: contract._address,
                    maxFeePerGas: String(maxFeePerGas),
                    maxPriorityFeePerGas: String(maxPriorityFeePerGas),
                    gasLimit: BlockchainConfig.blockchain[this.GLOBAL.blockchain].GAS_LIMIT_LOW,
                    data: dataTransfer
                };

                //sign tx
                let signedTransferTx = await this.GLOBAL.web3Instance.eth.accounts.signTransaction(rawTransferTx, this.GLOBAL.ownerPK);  
                
                //send signed transaction
                let transferTx = await this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedTransferTx.raw || signedTransferTx.rawTransaction);
                console.log(`### ${_amount} ${_erc20.symbol} transfered successfully: ###`);   
                console.log(`### tx: ${transferTx.transactionHash} ###`);       
                resolve(transferTx);

            } catch (error) {
                reject(error);
            }
        });
        return txPromise;  
    }

    /**
     * query _token balance of the given _address   
     * @param {*} _token 
     * @param {String} _address 
     * @returns balance (Number) 
     */
    async getBalanceOfERC20(_token, _address){
        Util.assertValidInputs([_token, _address], "getBalanceOfERC20");
        try {
            let erc20contract = await this.getERC20singleton(_token);
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
     * get decimals of a given token address
     * @param {*} _tokenAddress 
     * @returns decimals (Int)
     */
    async getDecimals(_tokenAddress){
        Util.assertValidInputs([_tokenAddress], "getDecimals");
        try {
            let erc20contract = await this.createERC20instance(_tokenAddress);
            if(erc20contract === undefined){
                throw ("Error trying to get ERC20instance")
            }
            let decimals = await erc20contract.methods.decimals().call();
            
            if(!decimals){
                throw (`Error tryng to get decimals of token ${_tokenAddress}`);
            }
            return parseInt(decimals);            
        } catch (error) {
            throw new Error(error);
        }
    }

    /**
     * Converts WETH back to ETH
     * @param {*} _amount 
     * @returns transaction (Promise)
     */
    async withdrawCryptofromWrappedCrypto(_amount, _wrappedToken){
        Util.assertValidInputs([_amount, _wrappedToken], "withdrawCryptofromWrappedCrypto");
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {            
                            
                //instanctiate erc20 contract
                let wrappedContract = this.getERC20singleton(_wrappedToken);
                
                //approve erc20 contract
                await this.approve(_wrappedToken, wrappedContract._address, _amount);

                //encode withdraw method 
                let dataWithdraw = wrappedContract.methods.withdraw(Util.amountToBlockchain(_amount)).encodeABI(); 
                
                //sets maxFeePerGas and maxPriorityFeePerGas, lesser values were generating 'transaction underpriced' error on Polygon mainnet 
                let maxPriorityFeePerGas = await this.GLOBAL.web3Instance.eth.getGasPrice();
                let maxFeePerGas = maxPriorityFeePerGas * 3;

                //declare raw tx to withdraw
                let rawWithdrawTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: wrappedContract._address,
                    maxFeePerGas: String(maxFeePerGas),
                    maxPriorityFeePerGas: String(maxPriorityFeePerGas),
                    gasLimit: BlockchainConfig.blockchain[this.GLOBAL.blockchain].GAS_LIMIT_LOW,
                    data: dataWithdraw
                };

                //sign tx
                let signedWithdrawTx = await this.GLOBAL.web3Instance.eth.accounts.signTransaction(rawWithdrawTx, this.GLOBAL.ownerPK);  
                
                //send signed transaction
                let withdrawTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedWithdrawTx.raw || signedWithdrawTx.rawTransaction);
                withdrawTx.on("receipt", (receipt) => {
                    console.log(`### ${_amount} ETH withdrawn successfully: ###`);   
                    console.log(`### tx: ${receipt.transactionHash} ###`);                                         
                    resolve(receipt);
                });
                withdrawTx.on("error", (err) => {
                    console.log("### approve tx error: ###");
                    reject(err);
                }); 

            } catch (error) {
                reject(error);
            }
        });
        return txPromise;  
    }

    /**
     * Approve ERC20 contract to spend the given amount
     * @param {*} _amount 
     * @returns transaction (Promise)
     */
     async approve(_token, _spender, _amount){
        Util.assertValidInputs([_token, _spender, _amount], "approve");
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {  
                let contractInstance = await this.getERC20singleton(_token);
                let dataApprove = contractInstance.methods.approve(_spender, Util.amountToBlockchain(_amount, _token.decimals)).encodeABI(); 
                
                //sets maxFeePerGas and maxPriorityFeePerGas, lesser values were generating 'transaction underpriced' error on Polygon mainnet 
                let maxPriorityFeePerGas = await this.GLOBAL.web3Instance.eth.getGasPrice();
                let maxFeePerGas = maxPriorityFeePerGas * 3;

                //declare raw tx to approve
                let rawApproveTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: contractInstance._address,
                    maxFeePerGas: String(maxFeePerGas),
                    maxPriorityFeePerGas: String(maxPriorityFeePerGas),
                    gasLimit: BlockchainConfig.blockchain[this.GLOBAL.blockchain].GAS_LIMIT_LOW,
                    data: dataApprove
                };

                //sign tx
                let signedApproveTx = await this.GLOBAL.web3Instance.eth.accounts.signTransaction(rawApproveTx, this.GLOBAL.ownerPK);                
                
                //send signed transaction
                let approveTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedApproveTx.raw || signedApproveTx.rawTransaction);
                approveTx.on("receipt", async (receipt) => {
                    console.log("### amount approved successfully: ###"); 
                    console.log(`### tx: ${receipt.transactionHash} ###`);   
                    resolve(receipt);          
                });
                approveTx.on("error", (err) => {
                    console.log("### approve tx error: ###");
                    reject(err);
                }); 
            } catch (error) {
                reject(error);
            }
        });
        return txPromise;  
    }

}

module.exports = ERC20ops;