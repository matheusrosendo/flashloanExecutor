const fs = require("fs");
const path = require("path");
const Web3 = require('web3');
const Flashloan = require("./build/contracts/FlashloanExecutor");
const SwapCurveV1 = require("./build/contracts/SwapCurveV1");
const truffleConfig = require("./truffle-config.js");
const Files = require("./Files.js");
const Util = require("./Util.js");
require("dotenv").config({path: ".env"});
const blockchainConfig = require("./BlockchainConfig.js");

//global variables
let web3Instance;
let network;
let blockchain;
let ownerAddress;

function exit(){
    process.exit();
}

const erc20list = {
    DAI: 0,
    USDC: 1,
    USDT: 2,
    WETH: 3,
    WMATIC: 4,
  };

//SINGLETON contract instances
let DAIcontract, USDCcontract, USDTcontract, WETHcontract, WMATICcontract;


/**
 * Web3 singleton 
 * @returns 
 */
function getWeb3Instance(_network){
    try {       
        if(web3Instance === undefined){
            web3Instance = new Web3(truffleConfig.networks[_network].provider);
            web3Instance.eth.handleRevert = true;
        }
    } catch (error) {
        throw new Error("Error to connect to "+_network+" error: "+error);
    }
    return  web3Instance; 
}

async function getCurrentBlock(_network){
    let blockNumber;
    try {
        block = await web3Instance.eth.getBlock("latest");
        blockNumber = block.number;
    } catch (error) {
        throw new Error("trying to get block, verify connection with "+"http://"+truffleConfig.networks[_network].host+":"+truffleConfig.networks[_network].port);
    }
    return blockNumber;
}

async function serializeResult(_response, _parsedJson, _inputFileName, _network){
    let serializedFile;

    try {
        let newBalanceNumber = Util.amountFromBlockchain(_response.events.LoggerBalance.returnValues.newBalance, 18);
        let oldBalanceNumber = Util.amountFromBlockchain(_response.events.LoggerBalance.returnValues.oldBalance, 18);
        let profit = newBalanceNumber - oldBalanceNumber; 
        //get result data
        let result = {
            tx: _response.transactionHash,
            blockNumber: _response.blockNumber,
            tokenBorrowed: _parsedJson.addressPath[1],
            oldBalance: _response.events.LoggerBalance.returnValues.oldBalance,
            newBalance: _response.events.LoggerBalance.returnValues.newBalance,
            profit: profit
        }
        _parsedJson.result = result;
        
        //define new file name and serialize it
        let originalFileArr = _inputFileName.split("\\");
        let originalFileName = originalFileArr[originalFileArr.length-1];
        let newFileName = originalFileName.split(".")[0];
        newFileName = newFileName + "_exec_"+Util.formatTimeForFileName(new Date())+".json";
        let fileNameEntirePath = path.join(__dirname, process.env.NETWORKS_FOLDER, _network, process.env.FLASHLOAN_OUTPUT_FOLDER, newFileName);
        await Files.serializeObjectListToJson(fileNameEntirePath, _parsedJson);
        let testSerializedFile = Files.parseJSONtoOjectList(fileNameEntirePath);
        if(testSerializedFile !== undefined && testSerializedFile !== null){
            serializedFile = {};
            serializedFile.content = testSerializedFile;
            serializedFile.path = fileNameEntirePath;
        }
    } catch (error) {
        console.log("Error serializing log file");  
    }
    return serializedFile;
}



async function executeFlashloanPromisse (network, parsedJson){
    console.log("### Executing flashloan on "+network+" of $"+parsedJson.initialAmountInUSD+" to path "+parsedJson.path+" ###"); 
    try {
    
        let Web3js = getWeb3Instance(network);
        
        let amountToBorrowOfFirstToken = Util.amountToBlockchain(parsedJson.initialTokenAmount, parsedJson.initialTokenDecimals);
        let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, Flashloan.networks[truffleConfig.networks[network].network_id].address, { from: String(process.env.OWNER_ADDRESS)})
        let FlashloanRawTx = {
            from: String(process.env.OWNER_ADDRESS),
            chainId:truffleConfig.networks[network].network_id,
            gasLimit: 12000000,
            gasPrice: 0
        };
        let result = await flashloanContract.methods.flashloanAAVEv1(amountToBorrowOfFirstToken, parsedJson.addressPath).send(FlashloanRawTx); 
        return result;
        
    } catch (error) {
        throw new Error(error.reason)  ;
    }                    
}

function withdrawToken (_network, _tokenAddress){
    console.log("### Withdrawing profits in DAI ###"); 
    try {
        let Web3js = getWeb3Instance(_network);
        
        let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, Flashloan.networks[truffleConfig.networks[_network].network_id].address, { from: String(process.env.OWNER_ADDRESS) })
        let FlashloanRawTx = {
            from: String(process.env.OWNER_ADDRESS),
            chainId:truffleConfig.networks[_network].network_id,
            gasLimit: 12000000,
            gasPrice: 0
        };
        return flashloanContract.methods.withdraw(_tokenAddress).send(FlashloanRawTx);                     
    } catch (error) {
        throw new Error(error.reason);
    }  
}

function withdrawTokenSigned (_network, _tokenAddress){
    console.log("### Withdrawing profits in DAI ###"); 
    try {
        let Web3js = getWeb3Instance(_network);
        
        let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, Flashloan.networks[truffleConfig.networks[_network].network_id].address, { from: String(process.env.OWNER_ADDRESS) })
            
        
        let FlashloanRawTx = {
            from: String(process.env.OWNER_ADDRESS),
            chainId:truffleConfig.networks[_network].network_id,
            gasLimit: 12000000,
            gasPrice: 0
        };

        //sign tx
        let signedTxPromise = Web3js.eth.signTransaction(FlashloanRawTx, String(process.env.OWNER_PK));
                    
        //handle response tx
        signedTxPromise.then((signedTx)=>{
            let sentTx = flashloanContract.methods.withdraw(_tokenAddress).sendSignedTransaction(signedTx.raw || signedTx.rawTransaction); 
            
            sentTx.on("receipt", (receipt) => {
                console.log("### tx sent successfully: ###");
                console.log(receipt);
            });
            sentTx.on("error", (err) => {
                console.log("### send tx error: ###");
                console.log(err);
                //exit();
            });
        }).catch((err) =>{
            console.log("### sign tx error: ###");
            console.log(err);
            //exit();
        })
        return signedTxPromise;         
    } catch (error) {
        throw new Error(error.reason) ;
    }              
}

/**
 * Verifies if contract was deployed and the owner is the informed address
 * @param {*} _network 
 * @param {*} _address 
 * @returns 
 */
async function isContractOk(_network, _OwnerAddress){
    try {
        let Web3js = getWeb3Instance(_network);
        let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, Flashloan.networks[truffleConfig.networks[_network].network_id].address)
        let owner = await flashloanContract.methods.owner().call(); 
        if (owner == _OwnerAddress){
            return true;
        } else {
            console.log("Error: contract found but owner is not the informed address, owner found = "+owner);
            return false;
        }        
    } catch (error) {
        throw new Error("Are you sure Flashloan Contract is deployed? Error: "+error);
    }
}

async function getOwner(_network, _contract){
    try {
        let Web3js = getWeb3Instance(_network);
        let flashloanContract = new Web3js.eth.Contract(_contract.abi, _contract.networks[truffleConfig.networks[_network].network_id].address)
        let owner = await flashloanContract.methods.owner().call(); 
        return owner;
    } catch (error) {
        throw new Error (error);
    }
}

async function sendEth(_from, _to, _amount){
    let rawTx = {
        from: _from, 
        to: _to, 
        value: Util.amountToBlockchain(_amount, 18),
        maxFeePerGas: 10000000000
    };

    //sign tx
    let signedTx = await getWeb3Instance().eth.signTransaction(rawTx, String(process.env.OWNER_PK));
                
    //handle response tx
    let txPromise = new Promise((resolve, reject) =>{            
        try {
            let sentTx = getWeb3Instance().eth.sendSignedTransaction(signedTx.raw || signedTx.rawTransaction); 
            
            sentTx.on("receipt", (receipt) => {
                console.log(`### ${_amount} ETH sent successfully: ###`);
                resolve(receipt);
            });
            sentTx.on("error", (err) => {
                console.log("### send tx error: ###");
                throw(err);
            });                    
        } catch (error) {
            reject (new Error(error));
        }
    });
    return txPromise;
}

/**
 * Converts WETH back to ETH
 * @param {*} _amount 
 * @returns 
 */
async function withdrawEthfromWeth(_amount){
    
    //handle response tx
    let txPromise = new Promise(async (resolve, reject) =>{ 
        try {            
        
            //get instance and encode method 
            let wethContract = await getERC20instance(erc20list.WETH);
            let wethAddress = blockchainConfig.blockchain[blockchain].WETH9_ADDRESS;
            let dataApprove = wethContract.methods.approve(wethAddress, Util.amountToBlockchain(_amount)).encodeABI(); 
            
            //declare raw tx to approve
            let rawApproveTx = {
                from: ownerAddress, 
                to: wethAddress,
                maxFeePerGas: 10000000000,
                data: dataApprove
            };

            //sign tx
            let signedApproveTx = await getWeb3Instance().eth.signTransaction(rawApproveTx, ownerAddress);                
            
            //send signed transaction
            let approveTx = getWeb3Instance().eth.sendSignedTransaction(signedApproveTx.raw || signedApproveTx.rawTransaction);
            approveTx.on("receipt", async (receipt) => {
                console.log("### amount approved successfully: ###"); 
                //encode withdraw method 
                let dataWithdraw = wethContract.methods.withdraw(Util.amountToBlockchain(_amount)).encodeABI(); 
            
                //declare raw tx to withdraw
                let rawWithdrawTx = {
                    from: ownerAddress, 
                    to: wethAddress,
                    maxFeePerGas: 10000000000,
                    data: dataWithdraw
                };

                //sign tx
                let signedWithdrawTx = await getWeb3Instance().eth.signTransaction(rawWithdrawTx, ownerAddress);  
                
                //send signed transaction
                let withdrawTx = getWeb3Instance().eth.sendSignedTransaction(signedWithdrawTx.raw || signedWithdrawTx.rawTransaction);
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

/**
 * Singleton that creates a new web3 instance of a given ERC20 contract if it does not exist yet
 * @param {*} _erc20 
 * @returns 
 */
function getERC20instance(_erc20){
    try {       
        let ownerAddress = String(process.env.OWNER_ADDRESS);
        let contract;
        switch(_erc20){
            case erc20list.WETH :
                if(WETHcontract === undefined){
                    WETHcontract = new web3Instance.eth.Contract(blockchainConfig.blockchain[blockchain].WETH9_ABI, blockchainConfig.blockchain[blockchain].WETH9_ADDRESS, { from: ownerAddress });
                }
                contract = WETHcontract;
            break;
        }
        return contract;        
    } catch (error) {
        throw new Error(error);
    }
}

async function getBalanceOfERC20(_erc20, _address){
    try {
        let erc20contract = await getERC20instance(_erc20);
        if(erc20contract === undefined){
            throw ("Error trying to get ERC20instance")
        }
        let balanceInWei = await erc20contract.methods.balanceOf(_address).call();
        let decimals;
        switch(_erc20){
            case erc20list.WETH :
                decimals = blockchainConfig.blockchain[blockchain].WETH9_DECIMALS;
            break;
        }
        if(decimals === undefined){
            throw ("Error tryng to get decimals of token on BlockchainConfig file");
        }
        return Util.amountFromBlockchain(balanceInWei, decimals);
    } catch (error) {
        throw new Error(error);
    }
}

(async () => {
    console.time('Total Execution Time');    
    console.log("\n######################### START FLASHLOAN EXECUTION #########################");

    //read and verify arguments
    let mode = process.argv.filter((item, index) =>{return index >= 2})
    if(mode.length < 2){
        console.log("Error invalid call, less than 2 parameters. Ex: Node .\\Flashloaner.js 5 ethereum_fork_update ");
        exit();
    }

    //set network and some variables used to transfer initial amounts to contract and dev account (local forks only)
    network = mode[1];
    if(truffleConfig.networks[network] == undefined){
        throw new Error("invalid network name = "+network);
    }
    console.log("### network: "+network+" ###"); 
    blockchain = truffleConfig.networks[network].blockchain;
    ownerAddress = String(process.env.OWNER_ADDRESS); 
    let Web3js = getWeb3Instance(network);   
    let currentBlock = await getCurrentBlock(network);
    let network_id = truffleConfig.networks[network].network_id;
    let DAIcontract;  
    let DAIcontractABI = blockchainConfig.blockchain[blockchain].DAIabi;    
    let DAItokenAddress = blockchainConfig.blockchain[blockchain].DAIcontract;   
    let flashloanAddress = Flashloan.networks[network_id].address;   
    let SwapCurveV1Address = SwapCurveV1.networks[network_id].address;

    switch(mode[0]){
        case '1': //get some ETH from a rich account and send to dev and flashloan contract  (development mode only)
        console.log("######### Mode 1 | GET DAI and ETH #########");
            //send ETH from rich account to my dev account
            await Web3js.eth.sendTransaction({
                from: blockchainConfig.blockchain[blockchain].RICH_ADDRESS, 
                to: ownerAddress, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })

                      
            //send ETH to swapcurve contract
             await Web3js.eth.sendTransaction({
                from: blockchainConfig.blockchain[blockchain].RICH_ADDRESS, 
                to: SwapCurveV1Address, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })


            //send ETH from rich account to smart contract
            await Web3js.eth.sendTransaction({
                from: blockchainConfig.blockchain[blockchain].RICH_ADDRESS, 
                to: flashloanAddress, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })
            
            //send DAI from rich account to my dev account
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: blockchainConfig.blockchain[blockchain].RICH_ADDRESS })
            var rawTransaction = {
                from: blockchainConfig.blockchain[blockchain].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(ownerAddress, Web3.utils.toWei(process.env.DAI_AMOUNT_INITIAL_FUND_ON_FORK)).encodeABI(),
                gas: 200000,
                chainId: network_id
            };            
            await Web3js.eth.sendTransaction(rawTransaction, (error, receipt) => {
                if (error) {
                    console.log('DEBUG - error in _sendToken ', error)
                }
                console.log(receipt);
            });

            //send DAI from rich account to flashloan contract
            var rawTransaction = {
                from: blockchainConfig.blockchain[blockchain].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(flashloanAddress, Web3.utils.toWei(process.env.DAI_AMOUNT_INITIAL_FUND_ON_FORK)).encodeABI(),
                gas: 200000,
                chainId: network_id
            };            
            await Web3js.eth.sendTransaction(rawTransaction, (error, receipt) => {
                if (error) {
                    console.log('DEBUG - error in _sendToken ', error)
                }
                console.log(receipt);
            });

             //send DAI from rich account to swapCurve contract
             var rawTransaction = {
                from: blockchainConfig.blockchain[blockchain].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(SwapCurveV1Address, Web3.utils.toWei(process.env.DAI_AMOUNT_INITIAL_FUND_ON_FORK)).encodeABI(),
                gas: 200000,
                chainId: network_id
            };            
            await Web3js.eth.sendTransaction(rawTransaction, (error, receipt) => {
                if (error) {
                    console.log('DEBUG - error in _sendToken ', error)
                }
                console.log(receipt);
            });
            console.log("SwapCurveV1Address = "+SwapCurveV1Address);
            console.log("### ETH and DAI sent ###");
            exit()
            
        break;

        case '1.1': //get some ETH from a rich account and send to dev and flashloan contract  (development mode only)
        console.log("######### Mode 1.1 | SIGNED TRANSACTION #########");
           
            let rawTx = {
                from: process.env.OWNER_ADDRESS, 
                to: flashloanAddress, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK),
                maxFeePerGas: 10000000000
            };
    
            //sign tx
            let signedTx = await Web3js.eth.signTransaction(rawTx, String(process.env.OWNER_PK));
                        
            //handle response tx
            let txPromise = new Promise((resolve, reject) =>{            
                try {
                    let sentTx = Web3js.eth.sendSignedTransaction(signedTx.raw || signedTx.rawTransaction); 
                    
                    sentTx.on("receipt", (receipt) => {
                        console.log("### tx sent successfully: ###");
                        resolve(receipt);
                    });
                    sentTx.on("error", (err) => {
                        console.log("### send tx error: ###");
                        throw(err);
                    });                    
                } catch (error) {
                    reject (new Error(error));
                }
            });
            let resolvedTx = await Promise.resolve(txPromise);
            console.log(resolvedTx);

            
        break;

        case '1.2': // exchange ETH by WETH
            try { 
                //get weth address, to convert eth to weth just send eth to weth contract address, since it has a payable function that calls deposit function inside
                let weth9address = blockchainConfig.blockchain[blockchain].WETH9_ADDRESS;
                let txSentEth = await sendEth(ownerAddress, weth9address, 2);
                console.log(txSentEth.transactionHash);
                let balanceOwner = await getBalanceOfERC20(erc20list.WETH, ownerAddress);
                console.log(`balanceOwner ${balanceOwner}`)
                
            } catch (error) {
                throw new Error(error);
            }
        break;

        case '1.3': // exchange WETH back to ETH
            try { 
                //get weth address, to convert eth to weth just send eth to weth contract address, since it has a payable function that calls deposit function inside
                let amountETH = 5;
                let tx = await withdrawEthfromWeth(amountETH);
                console.log(tx.transactionHash);
                
                
            } catch (error) {
                throw new Error(error);
            }
        break
        
        case '2': //Fund Flashloan smart contract with DAI
            console.log("######### Mode 2 | FUND SC FLASHLOAN WITH DAI #########");
            //get some DAI from a rich account  (development mode only)
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: blockchainConfig.blockchain[blockchain].RICH_ADDRESS })
            
            //send DAI from rich account to flashloan contract
            var rawTransaction = {
                from: blockchainConfig.blockchain[blockchain].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(flashloanAddress, Web3.utils.toWei(process.env.DAI_AMOUNT_INITIAL_FUND_ON_FORK)).encodeABI(),
                gas: 200000,
                chainId: network_id,
            };            
            await Web3js.eth.sendTransaction(rawTransaction, (error, receipt) => {
                if (error) {
                    console.log('DEBUG - error in _sendToken ', error)
                }
                console.log(receipt);
            });
            console.log("### ETH and DAI sent ###")
            exit();
            
        break;

        // check flashloan contract DAI and ETH balances
        // Ex: node .\Flashloaner.js 3 ethereum_fork_update
        case '3': 
        console.log("######### Mode 3 | VERIFY SC BALANCES #########");
            if(isContractOk(network, ownerAddress)){
                console.log("### balances of contract "+flashloanAddress+" ###");
                //check balance of DAI in the Flashloan Smartcontract
                DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: ownerAddress});
                let DAIbalanceFlashloanContract = await DAIcontract.methods.balanceOf(flashloanAddress).call();
                console.log("DAIbalanceFlashloanContract (DAI)= " + Web3.utils.fromWei(DAIbalanceFlashloanContract));
                console.log("DAIbalanceFlashloanContract (Wei DAI)= " + DAIbalanceFlashloanContract);
    
                let ownerEth = await Web3js.eth.getBalance(ownerAddress);
                console.log("ETH ownerAddress balance = " + Web3.utils.fromWei(ownerEth));

                let ETHbalanceFlashloanContract = await Web3js.eth.getBalance(flashloanAddress);
                console.log("ETHbalanceFlashloanContract = " + Web3.utils.fromWei(ETHbalanceFlashloanContract));

                let ETHbalanceSwapCurve = await Web3js.eth.getBalance(SwapCurveV1Address);
                console.log("ETHbalanceSwapCurve = " + Web3.utils.fromWei(ETHbalanceSwapCurve));

                let DAIbalanceSwapCurveV1 = await DAIcontract.methods.balanceOf(SwapCurveV1Address).call();
                console.log("DAIbalanceSwapCurveV1 = " + Web3.utils.fromWei(DAIbalanceSwapCurveV1));

                let swapCurveContract = new Web3js.eth.Contract(SwapCurveV1.abi, SwapCurveV1.networks[truffleConfig.networks[network].network_id].address, { from: String(process.env.OWNER_ADDRESS)})
                let USDCbalanceSwapCurveV1 = await swapCurveContract.methods.balanceOfToken("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48").call();
                console.log("USDCbalanceSwapCurveV1 = " + USDCbalanceSwapCurveV1 / Math.pow(10, 6));
                exit();
            }

        break;
        
        // check dev account DAI and ETH balances
        // Ex: node .\Flashloaner.js 4 ethereum_fork_update
        case '4': 
            console.log("######### Mode 4 | EXECUTOR ACCOUNT BALANCES #########");
            console.log("### balances of owner account "+ownerAddress+" ###");   
            //check balance of DAI in the Flashloan Smartcontract
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress);
            let DAIbalanceDevAccount = await DAIcontract.methods.balanceOf(ownerAddress).call();
            console.log("DAI = " + Web3.utils.fromWei(DAIbalanceDevAccount));

            let ETHbalanceDevAccount = await Web3js.eth.getBalance(ownerAddress);
            console.log("ETH = " + Web3.utils.fromWei(ETHbalanceDevAccount));

            let balanceOwner = await getBalanceOfERC20(erc20list.WETH, ownerAddress);
            console.log(`WETH ${balanceOwner}`)
            exit();
        break;
        
        //withdraw DAI to owner
         // Ex: node .\Flashloaner.js 5 ethereum_fork_update
        case '5': 
            try {
                //verify current DAI amount
                DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: ownerAddress});
                let DAIbalanceFlashloanContract = await DAIcontract.methods.balanceOf(flashloanAddress).call();
                if (parseInt(DAIbalanceFlashloanContract) > 0){
                    let response = await withdrawToken(network, DAItokenAddress);
                    if (response){
                        let DAIwithdrawn = parseInt(response.events.LogWithdraw.returnValues.amount);
                        console.log("#### CONGRATS!!! "+parseFloat(DAIwithdrawn / Math.pow(10, 18) ).toFixed(2)+" DAI withdrawn with success! ####")
                        console.log("tx: "+response.transactionHash);                    
                    }
                } else {
                    console.log("### NO BALANCE of DAI found for "+flashloanAddress);
                }
                
            } catch (error) {
                throw new Error(error);
            }
        break;
        case '5.1': //withdraw signed
            try {
                //verify current DAI amount
                DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: ownerAddress});
                let DAIbalanceFlashloanContract = await DAIcontract.methods.balanceOf(flashloanAddress).call();
                if (parseInt(DAIbalanceFlashloanContract) > 0){
                    let response = await withdrawTokenSigned(network, DAItokenAddress);
                    if (response){
                        let DAIwithdrawn = parseInt(response.events.LogWithdraw.returnValues.amount);
                        console.log("#### CONGRATS!!! "+parseFloat(DAIwithdrawn / Math.pow(10, 18) ).toFixed(2)+" DAI withdrawn with success! ####")
                        console.log("tx: "+response.transactionHash);                    
                    }
                } else {
                    console.log("### NO BALANCE of DAI found for "+flashloanAddress);
                }
                
            } catch (error) {
                throw new Error(error);
            }
        break;
        
        // print last block   
        case '6': 
            try {
                console.log("######### Mode 6 | LOG BLOCK INFO #########");
                let logPath = path.join(__dirname, process.env.NETWORKS_FOLDER, network, "database", Util.formatDateTimeForFilename(new Date())+".log");
                let logContent = {};
                logContent.network = network;
                logContent.datetime = Util.formatDateTime(new Date());
                //the block just forked is one behind
                logContent.block = currentBlock-1;
                logContent.host = truffleConfig.networks[network].host;
                logContent.port = truffleConfig.networks[network].port;
                if(!Files.fileExists(logPath)){
                    await Files.serializeObjectListToLogFile(logPath, logContent);
                }   
            } catch (error) {
                throw new Error(error);
            }         
        break;
        
        // execute flash loan reading from a specific file
        // ex: node .\Flashloaner.js 7 ethereum_fork_update ethereum_fork_update\FlashloanInput\2022-09-30_09-35_exec_09-36.json
        case '7': 
            try {
                if(isContractOk(network, ownerAddress)){
                    
                    let fileName = mode[2];
                    let parsedJson = Files.parseJSONtoOjectList(fileName);
                    if(parsedJson == undefined){
                        throw new Error("file not found "+fileName);
                    }
                    network = parsedJson.network;
                    
                    let response = await executeFlashloanPromisse(network, parsedJson);
                    let serializedFile = await serializeResult(response, parsedJson, fileName, network);
                    console.log(serializedFile.result);
                    //remove original input file
                    if(serializedFile){
                        Files.deleteFile(fileName);
                    }
                }
            } catch (error) {
                throw new Error(error);
            }
        
        break;
       
        //search for a new file on flashloan input folder and execute it
        //ex: node .\Flashloaner.js 8 ethereum_fork_update ethereum_fork_update\FlashloanInput
        case '8': 
            console.log("######### Mode 8 | VERIFY INPUT FOLDER AND EXECUTE FLASHLOAN #########");
            
            try {
                if(mode.length < 3){
                    throw new Error("Invalid number of parameters! Ex: node .\\Flashloaner.js 8 EthereumForkUpdate Networks\\EthereumForkUpdate\\FlashloanInput");
                }

                //adjust to relative or absolute path
                let directoryPath = mode[2];
                if (directoryPath.search(":") == -1){
                    directoryPath = path.join(__dirname, mode[2]);
                } 

                //get flashloan files from directory informed
                let resolvedFiles = Files.listFiles(directoryPath);
                if(resolvedFiles.length == 0){
                    console.log("##### None new file found in "+directoryPath+" #####")
                } else {
                    //execute flashloan for each file
                    let promiseFileList = resolvedFiles.map(async (file) => {                  
                        if(file !== undefined){
                            try {
                                //parse flashloan file
                                let completeFileName = path.join(directoryPath, file);
                                let parsedJson = Files.parseJSONtoOjectList(completeFileName);
                                
                                //execute flashloan
                                let response = await executeFlashloanPromisse(network, parsedJson);
                                
                                //parse response data
                                if(response === undefined || response === null){
                                    console.log("Error: undefined response returned from executeFlashloanPromisse function!")
                                } else {
                                    //serialize log file with the execution data
                                    let serializedFile = await serializeResult(response, parsedJson, completeFileName, network);
                                    console.log("##### Flashloan Executed! output file:"+serializedFile.path+" results: #####")
                                    console.log(serializedFile.content.result);
                                    
                                    //remove original input file
                                    if(serializedFile){
                                        Files.deleteFile(completeFileName);                        
                                    }
                                    return serializedFile;
                                }
                            } catch (error) {
                                throw new Error(error);
                            }
                        }
                    });
                    await Promise.all(promiseFileList);
                }
            } catch (error) {
                throw new Error(error);
            }
        
        break;
        
        
        case '9.1': 
            console.log("######### Mode 9.1 | TEST CURVE SWAP #########");
            try {
                let Web3js = getWeb3Instance(network);
        
                let amountToExchange = Web3.utils.toWei("1000");
                let tokenInAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
                let tokenOutAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
                let poolAddress = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

                let swapCurveContract = new Web3js.eth.Contract(SwapCurveV1.abi, SwapCurveV1.networks[truffleConfig.networks[network].network_id].address, { from: String(process.env.OWNER_ADDRESS)})
                let SwapCurveRawTx = {
                    from: String(process.env.OWNER_ADDRESS),
                    chainId:truffleConfig.networks[network].network_id,
                    gasLimit: 12000000,
                    gasPrice: 0
                };
                let txResult = await swapCurveContract.methods.exchangeOnCurveV1(amountToExchange, tokenInAddress, tokenOutAddress, poolAddress).send(SwapCurveRawTx); 
                console.log(txResult.events.LoggerSwap.returnValues);
                console.log("###### New amount of ("+tokenOutAddress+"): ######");
                let newBalance = await swapCurveContract.methods.balanceOfToken(tokenOutAddress).call();
                console.log(newBalance / Math.pow(10, 6));
            } catch (error) {
                throw new Error(error);
            }
        break;
        case '9.2': 
            console.log("######### Mode 9.2 | TEST AMOUNT OUT CURVE SWAP #########");
            try {
                let Web3js = getWeb3Instance(network);
        
                let amountToExchange = Web3.utils.toWei("1000");
                let tokenInAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
                let tokenOutAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
                let poolAddress = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

                let swapCurveContract = new Web3js.eth.Contract(SwapCurveV1.abi, SwapCurveV1.networks[truffleConfig.networks[network].network_id].address, { from: String(process.env.OWNER_ADDRESS)});
                let amountOut = await swapCurveContract.methods.amountOutOnCurveV1(amountToExchange, tokenInAddress, tokenOutAddress, poolAddress).call(); 
                console.log("###### Estimated amount out ("+tokenOutAddress+"): ######");
                console.log(amountOut / Math.pow(10, 6));
            } catch (error) {
                throw new Error(error);
            }
        break;

        //show main address
        case '10': 
            console.log("######### Mode 10 | SHOW MAIN ADDRESSES #########");
            let ownerFlashloan = await getOwner(network, Flashloan);
            console.log("ownerAddress: "+ownerAddress);
            console.log("flashloanAddress: "+flashloanAddress);
            console.log("flashloan Owner Address: "+ownerFlashloan);
            console.log("DAItokenAddress: "+DAItokenAddress);
            console.log("Host: "+truffleConfig.networks[network].host);
            console.log("Port: "+truffleConfig.networks[network].port);


        break;
        //show main address
        case '11': 
            let chainId = await Web3js.eth.getChainId()
            console.log("chainId = "+chainId);


        break;

        //testes com amountTo and AmountFrom
        case '12':
            let testeResultTo = Util.amountToBlockchain(5, 8);
            let testeResultFrom = Util.amountFromBlockchain(testeResultTo, 8);
            console.log(testeResultTo);
            console.log(testeResultFrom);
            
        break;
        

        default:
            try{                
                console.log("Invalid parameter: "+mode)
            } catch (erro) {
                console.log(erro);
            } 
        break;  
        
    }
    console.timeEnd('Total Execution Time');
    console.log("######################### END FLASHLOAN EXECUTION #########################\n");
    exit();
    
})();