const {blockchainConfig, erc20list} = require("./BlockchainConfig.js");
const Util = require("./Util.js");

class ERC20ops {
    

    constructor (_GLOBAL){
        this.GLOBAL = _GLOBAL;
        this.WETHcontract;
        this.DAIcontract;
        this.USDCcontract;
        this.USDTcontract;
    }

    getNetwork(){
        return this.GLOBAL.network;
    }

    /**
     * Singleton that creates a new web3 instance of a given ERC20 contract if it does not exist yet
     * @param {*} _erc20 
     * @returns 
     */
    getERC20instance(_erc20){
        try {       
            let contract;
            switch(_erc20){
                case erc20list.WETH :
                    if(this.WETHcontract === undefined){
                        this.WETHcontract = new this.GLOBAL.web3Instance.eth.Contract(blockchainConfig.blockchain[this.GLOBAL.blockchain].WETH9_ABI, blockchainConfig.blockchain[this.GLOBAL.blockchain].WETH9_ADDRESS, { from: this.GLOBAL.ownerAddress });
                    }
                    contract = this.WETHcontract;
                break;
                case erc20list.DAI :
                    if(this.DAIcontract === undefined){
                        this.DAIcontract = new this.GLOBAL.web3Instance.eth.Contract(blockchainConfig.blockchain[this.GLOBAL.blockchain].DAI_ABI, blockchainConfig.blockchain[this.GLOBAL.blockchain].DAI_ADDRESS, { from: this.GLOBAL.ownerAddress });
                    }
                    contract = this.DAIcontract;
                break;
                case erc20list.USDC :
                    if(this.USDCcontract === undefined){
                        this.USDCcontract = new this.GLOBAL.web3Instance.eth.Contract(blockchainConfig.blockchain[this.GLOBAL.blockchain].USDC9_ABI, blockchainConfig.blockchain[this.GLOBAL.blockchain].USDC9_ADDRESS, { from: this.GLOBAL.ownerAddress });
                    }
                    contract = this.USDCcontract;
                break;
                case erc20list.USDT :
                    if(this.USDTcontract === undefined){
                        this.USDTcontract = new this.GLOBAL.web3Instance.eth.Contract(blockchainConfig.blockchain[this.GLOBAL.blockchain].USDT9_ABI, blockchainConfig.blockchain[this.GLOBAL.blockchain].USDT9_ADDRESS, { from: this.GLOBAL.ownerAddress });
                    }
                    contract = this.USDTcontract;
                break;

            }
            return contract;        
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
               
                //encode transfer method 
                let dataTransfer = contract.methods.transfer(_to, Util.amountToBlockchain(_amount)).encodeABI(); 
            
                //declare raw tx to transfer
                let rawTransferTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: contract._address,
                    maxFeePerGas: 10000000000,
                    data: dataTransfer
                };

                //sign tx
                let signedTransferTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawTransferTx, this.GLOBAL.ownerAddress);  
                
                //send signed transaction
                let transferTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedTransferTx.raw || signedTransferTx.rawTransaction);
                transferTx.on("receipt", (receipt) => {
                    console.log(`### ${_amount} ${Object.keys(erc20list)[_erc20]} transfered successfully: ###`);                                         
                    resolve(receipt);
                });
                transferTx.on("error", (err) => {
                    console.log("### approve tx error: ###");
                    reject(new Error(err));
                }); 

            } catch (error) {
                reject(new Error(error));
            }
        });
        return txPromise;  
    }

    async getBalanceOfERC20(_erc20, _address){
        try {
            let erc20contract = await this.getERC20instance(_erc20);
            if(erc20contract === undefined){
                throw ("Error trying to get ERC20instance")
            }
            let balanceInWei = await erc20contract.methods.balanceOf(_address).call();
            let decimals;
            switch(_erc20){
                case erc20list.WETH :
                    decimals = blockchainConfig.blockchain[this.GLOBAL.blockchain].WETH9_DECIMALS;
                break;
                case erc20list.DAI :
                    decimals = blockchainConfig.blockchain[this.GLOBAL.blockchain].DAI_DECIMALS;
                break;
                case erc20list.USDC :
                    decimals = blockchainConfig.blockchain[this.GLOBAL.blockchain].USDC_DECIMALS;
                break;
                case erc20list.USDT :
                    decimals = blockchainConfig.blockchain[this.GLOBAL.blockchain].USDT_DECIMALS;
                break;

                default:
                    throw new Error("informed erc20 is not on the list");
                break;
            }
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
                let wethContract = this.getERC20instance(erc20list.WETH);
                let wethAddress = blockchainConfig.blockchain[this.GLOBAL.blockchain].WETH9_ADDRESS;

                //approve erc20 contract
                await this.approve(erc20list.WETH, wethAddress, _amount);

                //encode withdraw method 
                let dataWithdraw = wethContract.methods.withdraw(Util.amountToBlockchain(_amount)).encodeABI(); 
            
                //declare raw tx to withdraw
                let rawWithdrawTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: wethAddress,
                    maxFeePerGas: 10000000000,
                    data: dataWithdraw
                };

                //sign tx
                let signedWithdrawTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawWithdrawTx, this.GLOBAL.ownerAddress);  
                
                //send signed transaction
                let withdrawTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedWithdrawTx.raw || signedWithdrawTx.rawTransaction);
                withdrawTx.on("receipt", (receipt) => {
                    console.log(`### ${_amount} ETH withdrawn successfully: ###`);                                         
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
     async approve(_erc20, _spender, _amount){
        
        //handle response tx
        let txPromise = new Promise(async (resolve, reject) =>{ 
            try {  
                let contractInstance, tokenAddress;           
                switch(_erc20){
                    case erc20list.WETH :
                        contractInstance = await this.getERC20instance(erc20list.WETH);
                    break;
                    default :
                        throw new Error("informed erc20 is not on the list");
                    break
                }
                
                let dataApprove = contractInstance.methods.approve(_spender, Util.amountToBlockchain(_amount)).encodeABI(); 
                
                //declare raw tx to approve
                let rawApproveTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: contractInstance._address,
                    maxFeePerGas: 10000000000,
                    data: dataApprove
                };

                //sign tx
                let signedApproveTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawApproveTx, this.GLOBAL.ownerAddress);                
                
                //send signed transaction
                let approveTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedApproveTx.raw || signedApproveTx.rawTransaction);
                approveTx.on("receipt", async (receipt) => {
                    console.log("### amount approved successfully: ###"); 
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