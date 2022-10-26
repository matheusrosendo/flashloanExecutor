require("dotenv").config({path: ".env"});
const fs = require("fs");
const path = require("path");
const Web3 = require('web3');
const Flashloan = require("./build/contracts/FlashloanExecutor");
const truffleConfig = require("./truffle-config.js");
const Files = require("./Files.js");
const Util = require("./Util.js");
const UniswapV3ops = require("./UniswapV3ops.js");
const ERC20ops = require("./ERC20ops.js");
const FlashOps = require("./FlashOps.js");
const {blockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");

//global variables
let GLOBAL = {
    web3Instance: null,
    network: null,
    blockchain: null,
    ownerAddress: null,
    tokenList: null,
    networkId: null
}
let FLASHLOAN_ADDRESS;


/**
 * Web3 singleton 
 * @returns 
 */
function getWeb3Instance(_network){
    try {       
        if(!GLOBAL.web3Instance){
            GLOBAL.web3Instance = new Web3(truffleConfig.networks[_network].provider);
            GLOBAL.web3Instance.eth.handleRevert = true;
        }
    } catch (error) {
        throw new Error("Error to connect to "+_network+" error: "+error);
    }
    return  GLOBAL.web3Instance; 
}

async function getCurrentBlock(_network){
    let blockNumber;
    try {
        block = await GLOBAL.web3Instance.eth.getBlock("latest");
        blockNumber = block.number;
    } catch (error) {
        throw new Error("trying to get block, verify connection with " + truffleConfig.networks[_network].RPCURL);
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
            });
        }).catch((err) =>{
            console.log("### sign tx error: ###");
            console.log(err);
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

async function showBalances(_address){
    let balanceETH = await GLOBAL.web3Instance.eth.getBalance(_address);
    console.log("ETH: " + Web3.utils.fromWei(balanceETH));

    let erc20ops = new ERC20ops(GLOBAL);     
    let balanceWETH = await erc20ops.getBalanceOfERC20(getERC20("WETH"), _address);
    console.log(`WETH: ${balanceWETH}`);
    let balanceDAI = await erc20ops.getBalanceOfERC20(getERC20("DAI"), _address);
    console.log(`DAI: ${balanceDAI}`);
    let balanceUSDT = await erc20ops.getBalanceOfERC20(getERC20("USDT"), _address);
    console.log(`USDT: ${balanceUSDT}`);
    let balanceUSDC = await erc20ops.getBalanceOfERC20(getERC20("USDC"), _address);
    console.log(`USDC: ${balanceUSDC}`);
} 

async function showInitInfo(){
    let currentBlock = await getCurrentBlock(GLOBAL.network);
    console.log(`\n### ${Util.formatDateTime(new Date())} ###`); 
    console.log(`### RPC provider: ${truffleConfig.networks[GLOBAL.network].RPCURL} ###`); 
    console.log(`### blockchain: ${GLOBAL.blockchain} ###`); 
    console.log(`### network: ${GLOBAL.network} | block: ${currentBlock} ###\n`); 
}

/**
 * alias to getItemFromTokenList
 * @param {*} _symbol 
 * @returns 
 */
function getERC20(_symbol){
    return getItemFromTokenList("symbol", _symbol, GLOBAL.tokenList);
}

(async () => {
    console.time('Total Execution Time');    
    console.log("\n######################### START FLASHLOANER EXECUTION #########################");

    //read and verify arguments
    let mode = process.argv.filter((item, index) =>{return index >= 2})
    if(mode.length < 2){
        throw new Error("Error invalid call, less than 2 parameters. Ex: Node .\\Flashloaner.js 5 ethereum_fork_update ");
    }

    //set network and some variables used to transfer initial amounts to contract and dev account (local forks only)
    let network = mode[1];
    if(truffleConfig.networks[network] == undefined){
        throw new Error("invalid network name = "+network);
    }
    
    
    //set GLOBAL main values
    GLOBAL.web3Instance = getWeb3Instance(network);
    GLOBAL.blockchain = truffleConfig.networks[network].blockchain;
    GLOBAL.network = network;
    GLOBAL.ownerAddress = String(process.env.OWNER_ADDRESS); ;
    GLOBAL.tokenList = blockchainConfig.blockchain[GLOBAL.blockchain].tokenList;
    GLOBAL.networkId = truffleConfig.networks[network].network_id;
    await showInitInfo();
    
    // if flashloan address was set in .env, set FLASHLOAN_ADFRESS global variable with it, 
    // or use local deployed contract address otherwise 
    if(!blockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOAN_ADDRESS){
        FLASHLOAN_ADDRESS = Flashloan.networks[GLOBAL.networkId].address;  
    } else {
        FLASHLOAN_ADDRESS = blockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOAN_ADDRESS
    }
     
    switch(mode[0]){
        case '1': //exchange some ETH by WETH, and than WETH by DAI on UniswapV3
        console.log("######### Mode 1 | ETH -> WETH -> DAI #########");
            //send ETH from rich account to my dev account
            await GLOBAL.web3Instance.eth.sendTransaction({
                from: blockchainConfig.blockchain[GLOBAL.blockchain].RICH_ADDRESS, 
                to: GLOBAL.ownerAddress, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })

                      
            //send ETH to swapcurve contract
             await GLOBAL.web3Instance.eth.sendTransaction({
                from: blockchainConfig.blockchain[GLOBAL.blockchain].RICH_ADDRESS, 
                to: SwapCurveV1Address, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })


            //send ETH from rich account to smart contract
            await GLOBAL.web3Instance.eth.sendTransaction({
                from: blockchainConfig.blockchain[GLOBAL.blockchain].RICH_ADDRESS, 
                to: flashloanAddress, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })
            
            //send DAI from rich account to my dev account
            DAIcontract = await new GLOBAL.web3Instance.eth.Contract(DAIcontractABI, DAItokenAddress, { from: blockchainConfig.blockchain[GLOBAL.blockchain].RICH_ADDRESS })
            var rawTransaction = {
                from: blockchainConfig.blockchain[GLOBAL.blockchain].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(ownerAddress, Web3.utils.toWei(process.env.DAI_AMOUNT_INITIAL_FUND_ON_FORK)).encodeABI(),
                gas: 200000,
                chainId: network_id
            };            
            await GLOBAL.web3Instance.eth.sendTransaction(rawTransaction, (error, receipt) => {
                if (error) {
                    console.log('DEBUG - error in _sendToken ', error)
                }
                console.log(receipt);
            });

            //send DAI from rich account to flashloan contract
            var rawTransaction = {
                from: blockchainConfig.blockchain[GLOBAL.blockchain].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(flashloanAddress, Web3.utils.toWei(process.env.DAI_AMOUNT_INITIAL_FUND_ON_FORK)).encodeABI(),
                gas: 200000,
                chainId: network_id
            };            
            await GLOBAL.web3Instance.eth.sendTransaction(rawTransaction, (error, receipt) => {
                if (error) {
                    console.log('DEBUG - error in _sendToken ', error)
                }
                console.log(receipt);
            });

             //send DAI from rich account to swapCurve contract
             var rawTransaction = {
                from: blockchainConfig.blockchain[GLOBAL.blockchain].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(SwapCurveV1Address, Web3.utils.toWei(process.env.DAI_AMOUNT_INITIAL_FUND_ON_FORK)).encodeABI(),
                gas: 200000,
                chainId: network_id
            };            
            await GLOBAL.web3Instance.eth.sendTransaction(rawTransaction, (error, receipt) => {
                if (error) {
                    console.log('DEBUG - error in _sendToken ', error)
                }
                console.log(receipt);
            });
            console.log("### ETH and DAI sent ###");
            
        break;

        case '1.1': //(local fork development mode only) exchange eth by weth, weth by dai
        console.log("######### Mode 1.1 | SIGNED TRANSACTION #########");
            let amount = Util.amountToBlockchain(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK);
            let from = String(process.env.OWNER_ADDRESS);
            let to = flashloanAddress; 
            let tx = await sendEth(from, to, amount);
            console.log(tx.transactionHash);
            
        break;

        case '1.2': // exchange ETH by WETH
            try { 
                //get weth address, to convert eth to weth just send eth to weth contract address, since it has a payable function that calls deposit function inside
                let amountETH = 2;
                let weth9address = getERC20("WETH").address;
                let txSentEth = await sendEth(GLOBAL.ownerAddress, weth9address, amountETH);
                console.log(txSentEth.transactionHash);
                let erc20ops = new ERC20ops(GLOBAL);
                let balanceOwner = await erc20ops.getBalanceOfERC20(getERC20("WETH"), GLOBAL.ownerAddress);
                console.log(`WETH balance of owner ${balanceOwner}`)
                
            } catch (error) {
                throw (error);
            }
        break;

        
        case '1.3': // exchange WETH back to ETH
            try { 
                //get weth address, to convert eth to weth just send eth to weth contract address, since it has a payable function that calls deposit function inside
                let amountETH = 2;
                let erc20ops = new ERC20ops(GLOBAL);
                let tx = await erc20ops.withdrawEthfromWeth(amountETH);
                console.log(tx.transactionHash);                
                let balanceOwner = await erc20ops.getBalanceOfERC20(getERC20("WETH"), GLOBAL.ownerAddress);
                console.log(`WETH balance of owner ${balanceOwner}`);
                
            } catch (error) {
                throw (error);
            }
        break
        
        case '1.4': // exchange WETH to DAI on UniswapV3
            try { 
                
                let amount = 1;
                let erc20ops = new ERC20ops(GLOBAL);  
                let balanceOwnerWETH = await erc20ops.getBalanceOfERC20(getERC20("WETH"), GLOBAL.ownerAddress);
                console.log(`Current WETH balance of owner ${balanceOwnerWETH}`);
                if(balanceOwnerWETH < amount){
                    throw new Error("not enough balance of WETH");
                } else {
                    let uniswapV3 = new UniswapV3ops(GLOBAL);
                    let tx = await uniswapV3.exchangeWETHbyDAI(amount, GLOBAL.ownerAddress);
                    console.log(tx.transactionHash);  
                    
                    let balanceOwnerDAI = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);
                    console.log(`DAI balance of owner ${balanceOwnerDAI}`);
                    let newBalanceOwnerWETH = await erc20ops.getBalanceOfERC20(getERC20("WETH"), GLOBAL.ownerAddress);
                    console.log(`WETH balance of owner ${newBalanceOwnerWETH}`);
                }
            } catch (error) {
                throw (error);
            }
        break

        case '1.5': // transfer DAI to flashloan contract
            try { 
                let erc20ops = new ERC20ops(GLOBAL);  
                let tx = await erc20ops.transfer(getERC20("DAI"), flashloanAddress, 1000);
                console.log(tx.transactionHash);
                let newBalanceOwnerDAI = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);
                let newBalanceFlashloanContractDAI = await erc20ops.getBalanceOfERC20(getERC20("DAI"), flashloanAddress);
                console.log(`DAI balance of owner ${newBalanceOwnerDAI}`);
                console.log(`DAI balance of flashloan contract ${newBalanceFlashloanContractDAI}`);
            } catch (error) {
                throw (error);
            }
        break

        case '1.6': // withdraw token from contract
            try { 
               let flashOps = new FlashOps(GLOBAL, FLASHLOAN_ADDRESS);
               let tx = flashOps.withdrawToken(getERC20("DAI"));
               console.log(tx.transactionHash);
            } catch (error) {
                throw (error);
            }
        break
        case '1.7': // swap between two token on UniswapV3
            try { 
               let uniOps = new UniswapV3ops(GLOBAL, FLASHLOAN_ADDRESS);
               await uniOps.swap(1, getERC20("WETH"), getERC20("USDC"), 3000);
               
            } catch (error) {
                throw (error);
            }
        break
        case '1.8': // getPool address on UniswapV3
            try { 
               let uniOps = new UniswapV3ops(GLOBAL, FLASHLOAN_ADDRESS);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("USDC"), 10000);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("USDC"), 3000);               
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("USDC"), 500);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("USDC"), 100);

               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("DAI"), 10000);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("DAI"), 3000);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("DAI"), 500);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("DAI"), 100);

               await uniOps.showPoolAddress(getERC20("USDC"), getERC20("DAI"), 10000);
               await uniOps.showPoolAddress(getERC20("USDC"), getERC20("DAI"), 3000);
               await uniOps.showPoolAddress(getERC20("USDC"), getERC20("DAI"), 500);
               await uniOps.showPoolAddress(getERC20("USDC"), getERC20("DAI"), 100);
            } catch (error) {
                throw (error);
            }
        break

        case '2': //Fund Flashloan smart contract with DAI
            console.log("######### Mode 2 | FUND SC FLASHLOAN WITH DAI #########");
            //get some DAI from a rich account  (development mode only)
            DAIcontract = await new GLOBAL.web3Instance.eth.Contract(DAIcontractABI, DAItokenAddress, { from: blockchainConfig.blockchain[GLOBAL.blockchain].RICH_ADDRESS })
            
            //send DAI from rich account to flashloan contract
            var rawTransaction = {
                from: blockchainConfig.blockchain[GLOBAL.blockchain].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(flashloanAddress, Web3.utils.toWei(process.env.DAI_AMOUNT_INITIAL_FUND_ON_FORK)).encodeABI(),
                gas: 200000,
                chainId: network_id,
            };            
            await GLOBAL.web3Instance.eth.sendTransaction(rawTransaction, (error, receipt) => {
                if (error) {
                    console.log('DEBUG - error in _sendToken ', error)
                }
                console.log(receipt);
            });
            console.log("### ETH and DAI sent ###")
            
        break;

        // check flashloan contract balances
        // Ex: node .\Flashloaner.js 3 NETWORKNAME
        case '3': 
        console.log("######### Mode 3 | FLASHLOAN CONTRACT BALANCES #########");
            try {               
                if(isContractOk(network, GLOBAL.ownerAddress)){
                    console.log("### balances of contract "+FLASHLOAN_ADDRESS+" ###");
                    await showBalances(FLASHLOAN_ADDRESS);
                }
            } catch (error) {
                throw(error);
            }

        break;
        
        // check owner account  balances
        // Ex: node .\Flashloaner.js 4 NETWORKNAME
        case '4': 
            console.log("######### Mode 4 | OWNER ACCOUNT BALANCES #########");
                try {               
                    console.log("### balances of address "+GLOBAL.ownerAddress+" ###");
                    await showBalances(GLOBAL.ownerAddress);
                } catch (error) {
                    throw(error);
                }
        break;
        
        //withdraw DAI to owner
         // Ex: node .\Flashloaner.js 5 ethereum_fork_update
        case '5': 
            try {
                //verify current DAI amount
                DAIcontract = await new GLOBAL.web3Instance.eth.Contract(DAIcontractABI, DAItokenAddress, { from: GLOBAL.ownerAddress});
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
                throw (error);
            }
        break;
        case '5.1': //withdraw signed
            try {
                //verify current DAI amount
                DAIcontract = await new GLOBAL.web3Instance.eth.Contract(DAIcontractABI, DAItokenAddress, { from: GLOBAL.ownerAddress});
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
                throw (error);
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
                let currentBlock = getCurrentBlock(GLOBAL.network);
                logContent.block = currentBlock-1;
                logContent.host = truffleConfig.networks[network].host;
                logContent.port = truffleConfig.networks[network].port;
                if(!Files.fileExists(logPath)){
                    await Files.serializeObjectListToLogFile(logPath, logContent);
                }   
            } catch (error) {
                throw (error);
            }         
        break;
        
        // execute flash loan reading from a specific file
        // ex: node .\Flashloaner.js 7 ethereum_fork_update ethereum_fork_update\FlashloanInput\2022-09-30_09-35_exec_09-36.json
        case '7': 
            try {
                if(isContractOk(network, GLOBAL.ownerAddress)){
                    
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
                throw (error);
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
                throw (error);
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
                throw (error);
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
                throw (error);
            }
        break;

        //show main address
        case '10': 
            console.log("######### Mode 10 | SHOW MAIN ADDRESSES #########");
            let ownerFlashloan = await getOwner(network, Flashloan);
            console.log("GLOBAL.GLOBAL.ownerAddress: "+GLOBAL.ownerAddress);
            console.log("flashloanAddress: "+flashloanAddress);
            console.log("flashloan Owner Address: "+ownerFlashloan);
            console.log("DAItokenAddress: "+DAItokenAddress);
            console.log("Host: "+truffleConfig.networks[network].host);
            console.log("Port: "+truffleConfig.networks[network].port);


        break;
        //show main address
        case '11': 
            let chainId = await GLOBAL.web3Instance.eth.getChainId()
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
    process.exit();
    
})();