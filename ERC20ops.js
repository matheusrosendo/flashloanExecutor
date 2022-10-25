const {blockchainConfig, erc20list} = require("./BlockchainConfig.js");
const Util = require("./Util.js");

class ERC20ops {
    

    constructor (_GLOBAL){
        this.GLOBAL = _GLOBAL;
        this.WETHcontract;
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
            }
            return contract;        
        } catch (error) {
            throw new Error(error);
        }
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
            
                //get instance and encode method 
                let wethContract = await this.getERC20instance(erc20list.WETH);
                let wethAddress = blockchainConfig.blockchain[this.GLOBAL.blockchain].WETH9_ADDRESS;
                let dataApprove = wethContract.methods.approve(wethAddress, Util.amountToBlockchain(_amount)).encodeABI(); 
                
                //declare raw tx to approve
                let rawApproveTx = {
                    from: this.GLOBAL.ownerAddress, 
                    to: wethAddress,
                    maxFeePerGas: 10000000000,
                    data: dataApprove
                };

                //sign tx
                let signedApproveTx = await this.GLOBAL.web3Instance.eth.signTransaction(rawApproveTx, this.GLOBAL.ownerAddress);                
                
                //send signed transaction
                let approveTx = this.GLOBAL.web3Instance.eth.sendSignedTransaction(signedApproveTx.raw || signedApproveTx.rawTransaction);
                approveTx.on("receipt", async (receipt) => {
                    console.log("### amount approved successfully: ###"); 
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