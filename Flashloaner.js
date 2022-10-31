require("dotenv").config({path: ".env"});
const fs = require("fs");
const path = require("path");
const Web3 = require('web3');
const assert = require('assert');
const Flashloan = require("./build/contracts/FlashloanExecutor");
const FlashloanDodo = require("./build/contracts/FlashloanDodo");
const FlashloanNewInput = require("./build/contracts/FlashloanNewInput");
const truffleConfig = require("./truffle-config.js");
const Files = require("./Files.js");
const Util = require("./Util.js");
const UniswapV3ops = require("./UniswapV3ops.js");
const ERC20ops = require("./ERC20ops.js");
const FlashOps = require("./FlashOps.js");
const FlashDodoOps = require("./FlashDodoOps.js");
const FlashNewInputOps = require("./FlashNewInputOps.js");
const {blockchainConfig, getItemFromTokenList} = require("./BlockchainConfig.js");
const { get } = require("http");
const Spot = require('@binance/connector/src/spot')

Number.prototype.toFixedDown = function(digits) {
    var re = new RegExp("(\\d+\\.\\d{" + digits + "})(\\d)"),
        m = this.toString().match(re);
    return m ? parseFloat(m[1]) : this.valueOf();
};


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
let FLASHLOAN_DODO_ADDRESS;
let FLASHLOAN_NEWINPUT_ADDRESS;


/**
 * Web3 singleton 
 * @returns 
 */
function getWeb3Instance(_network){
    try {       
        if(!GLOBAL.web3Instance){
            GLOBAL.web3Instance = new Web3(truffleConfig.networks[_network].provider || truffleConfig.networks[_network].url);
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
        throw new Error("trying to get block, verify connection with " + blockchainConfig.network[_network].RPC_PROVIDER_URL);
    }
    return blockNumber;
}

async function getCurrentGasPriceInGwei(){
    let gasPriceInGwei;
    try {
        let gasPrice = await GLOBAL.web3Instance.eth.getGasPrice();
        gasPriceInGwei = Web3.utils.fromWei(gasPrice, "gwei");
    } catch (error) {
        throw new Error("trying to get gas price, verify connection with " + blockchainConfig.network[_network].RPC_PROVIDER_URL);
    }
    return gasPriceInGwei;
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

async function isContractDodoOk(_network, _OwnerAddress){
    try {
        let Web3js = getWeb3Instance(_network);
        let flashloanDodoContract = new Web3js.eth.Contract(FlashloanDodo.abi, FlashloanDodo.networks[truffleConfig.networks[_network].network_id].address)
        let owner = await flashloanDodoContract.methods.owner().call(); 
        if (owner == _OwnerAddress){
            return true;
        } else {
            console.log("Error: contract found but owner is not the informed address, owner found = "+owner);
            return false;
        }        
    } catch (error) {
        throw new Error("Are you sure Flashloan Dodo Contract is deployed? Error: "+error);
    }
}

async function isContractNewInputOk(_network, _OwnerAddress){
    try {
        let Web3js = getWeb3Instance(_network);
        let flashloanNewInputContract = new Web3js.eth.Contract(FlashloanNewInput.abi, FlashloanNewInput.networks[truffleConfig.networks[_network].network_id].address)
        let owner = await flashloanNewInputContract.methods.owner().call(); 
        if (owner == _OwnerAddress){
            return true;
        } else {
            console.log("Error: contract found but owner is not the informed address, owner found = "+owner);
            return false;
        }        
    } catch (error) {
        throw new Error("Are you sure Flashloan Dodo Contract is deployed? Error: "+error);
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
    let gasPriceInGwei = await getCurrentGasPriceInGwei();
    console.log(`\n### ${Util.formatDateTime(new Date())} ###`); 
    console.log(`### RPC provider: ${blockchainConfig.network[GLOBAL.network].RPC_PROVIDER_URL} ###`); 
    console.log(`### blockchain: ${GLOBAL.blockchain} ###`); 
    console.log(`### network: ${GLOBAL.network} | block: ${currentBlock} | last gas price: ${gasPriceInGwei} gwei ###\n`); 
    
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
    if(blockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOAN_ADDRESS){
        FLASHLOAN_ADDRESS = blockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOAN_ADDRESS
    } else {
        FLASHLOAN_ADDRESS = Flashloan.networks[GLOBAL.networkId].address; 
    }
    if(blockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOAN_DODO_ADDRESS){
        FLASHLOAN_DODO_ADDRESS = blockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOAN_DODO_ADDRESS
    } else {
        FLASHLOAN_DODO_ADDRESS = FlashloanDodo.networks[GLOBAL.networkId].address; 
    }
    if(blockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOAN_NEWINPUT_ADDRESS){
        FLASHLOAN_NEWINPUT_ADDRESS = blockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOAN_NEWINPUT_ADDRESS
    } else {
        FLASHLOAN_NEWINPUT_ADDRESS = FlashloanNewInput.networks[GLOBAL.networkId].address; 
    }
     
    switch(mode[0]){
        case '1': //LOCAL DEV ONLY: exchange some ETH by WETH, then WETH by DAI, and DAI by USDC on UniswapV3
            try{    
            console.log("######### Mode 1 | ETH -> WETH | WETH -> DAI | DAI -> USDC #########");
                //get weth address, to convert eth to weth just send eth to weth contract address, since it has a payable function that calls deposit function inside
                let amountETH = parseInt(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK);
                let weth9address = getERC20("WETH").address;
                await sendEth(GLOBAL.ownerAddress, weth9address, amountETH);

                //get WETH balance
                let erc20ops = new ERC20ops(GLOBAL);
                let balanceWETH = await erc20ops.getBalanceOfERC20(getERC20("WETH"), GLOBAL.ownerAddress);

                //exchange WETH by DAI
                let uniOps = new UniswapV3ops(GLOBAL);
                await uniOps.swap(balanceWETH, getERC20("WETH"), getERC20("DAI"), 500);

                //exchange half of DAI to USDC 
                let balanceDAI = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);
                await uniOps.swap(balanceDAI/2, getERC20("DAI"), getERC20("USDC"), 100);
                console.log("\n### owner balances: ###");
                await showBalances(GLOBAL.ownerAddress);
            } catch (error) {
                throw(error);
            }
            
        break;

        case '2': //Fund Flashloan smart contract with DAI and USDC
            console.log("######### Mode 2 | FUND FLASHLOAN CONTRACT #########");
            try {               
                let erc20ops = new ERC20ops(GLOBAL);
                let balanceDAIowner = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);
                 
                if(balanceDAIowner > 1){
                    await erc20ops.transfer( getERC20("DAI"), FLASHLOAN_ADDRESS, Number(balanceDAIowner).toFixedDown(4));
                } else{
                   console.error("Warning: no DAI on owner address");
                }

                let balanceUSDCowner = await erc20ops.getBalanceOfERC20(getERC20("USDC"), GLOBAL.ownerAddress);
                if(balanceUSDCowner > 1){
                    await erc20ops.transfer( getERC20("USDC"), FLASHLOAN_ADDRESS, Number(balanceUSDCowner).toFixedDown(4));
                } else{
                   console.error("Warning: no USDC on owner address");
                }

                console.log("\n### contract balances: ###");
                await showBalances(FLASHLOAN_ADDRESS); 

            } catch (error) {
                throw(error);
            }
            
        break;

        case '2.1': //Fund Flashloan DODO smart contract with DAI and USDC
            console.log("######### Mode 2.1 | FUND FLASHLOAN DODO CONTRACT #########");
            try {               
                let erc20ops = new ERC20ops(GLOBAL);
                let balanceDAIowner = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);
                
                if(balanceDAIowner > 1){
                    await erc20ops.transfer( getERC20("DAI"), FLASHLOAN_DODO_ADDRESS, Number(balanceDAIowner).toFixedDown(4));
                } else{
                console.error("Warning: no DAI on owner address");
                }

                let balanceUSDCowner = await erc20ops.getBalanceOfERC20(getERC20("USDC"), GLOBAL.ownerAddress);
                if(balanceUSDCowner > 1){
                    await erc20ops.transfer( getERC20("USDC"), FLASHLOAN_DODO_ADDRESS, Number(balanceUSDCowner).toFixedDown(4));
                } else{
                console.error("Warning: no USDC on owner address");
                }

                console.log("\n### contract balances: ###");
                await showBalances(FLASHLOAN_DODO_ADDRESS); 

            } catch (error) {
                throw(error);
            }
        break;

        case '2.2': //Fund Flashloan new input smart contract with DAI and USDC
            console.log("######### Mode 2.2 | FUND FLASHLOAN NEW INPUT CONTRACT #########");
            try {               
                let erc20ops = new ERC20ops(GLOBAL);
                let balanceDAIowner = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);
                
                if(balanceDAIowner > 1){
                    await erc20ops.transfer( getERC20("DAI"), FLASHLOAN_NEWINPUT_ADDRESS, Number(balanceDAIowner).toFixedDown(4));
                } else{
                console.error("Warning: no DAI on owner address");
                }

                let balanceUSDCowner = await erc20ops.getBalanceOfERC20(getERC20("USDC"), GLOBAL.ownerAddress);
                if(balanceUSDCowner > 1){
                    await erc20ops.transfer( getERC20("USDC"), FLASHLOAN_NEWINPUT_ADDRESS, Number(balanceUSDCowner).toFixedDown(4));
                } else{
                console.error("Warning: no USDC on owner address");
                }

                console.log("\n### contract balances: ###");
                await showBalances(FLASHLOAN_NEWINPUT_ADDRESS); 

            } catch (error) {
                throw(error);
            }
            
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
        case '3.1': 
        console.log("######### Mode 3.1 | FLASHLOAN DODO CONTRACT BALANCES #########");
            try {               
                if(isContractDodoOk(network, GLOBAL.ownerAddress)){
                    console.log("### balances of contract "+FLASHLOAN_DODO_ADDRESS+" ###");
                    await showBalances(FLASHLOAN_DODO_ADDRESS);
                }
            } catch (error) {
                throw(error);
            }

        break;

        case '3.2': 
        console.log("######### Mode 3.2 | FLASHLOAN NEW INPUT CONTRACT BALANCES #########");
            try {               
                if(isContractDodoOk(network, GLOBAL.ownerAddress)){
                    console.log("### balances of contract "+FLASHLOAN_NEWINPUT_ADDRESS+" ###");
                    await showBalances(FLASHLOAN_NEWINPUT_ADDRESS);
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
        // Ex: node .\Flashloaner.js 5 networkName
        case '5': 
            try { 
                let flashOps = new FlashOps(GLOBAL, FLASHLOAN_ADDRESS);
                let tx = await flashOps.withdrawToken(getERC20("DAI"));
                console.log(tx.transactionHash);
            } catch (error) {
                throw (error);
            }
        break;
         //withdraw DAI to owner
        // Ex: node .\Flashloaner.js 5 networkName
        case '5.1': 
            try { 
                let flashDodoOps = new FlashDodoOps(GLOBAL, FLASHLOAN_DODO_ADDRESS);
                let tx = await flashDodoOps.withdrawToken(getERC20("DAI"));
                console.log(tx.transactionHash);
            } catch (error) {
                throw (error);
            }
        break;
        case '5.2': 
            try { 
                let flashDodoOps = new FlashDodoOps(GLOBAL, FLASHLOAN_NEWINPUT_ADDRESS);
                let tx = await flashDodoOps.withdrawToken(getERC20("DAI"));
                console.log(tx.transactionHash);
            } catch (error) {
                throw (error);
            }
        break;
               
        // serialize last block in a log file inside database folder   
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
               
        
        //search for a new file on flashloan input folder and execute it
        //ex: node .\Flashloaner.js 8 networkName Networks\networkName\FlashloanInput
        case '8': 
            console.log("######### Mode 8 | VERIFY INPUT FOLDER AND EXECUTE FLASHLOAN #########");
            
            try {
                if(mode.length < 3){
                    throw new Error("Invalid number of parameters! Ex: node .\\Flashloaner.js 8 EthereumForkUpdate Networks\\EthereumForkUpdate\\FlashloanInput");
                }
                if(isContractOk(network, GLOBAL.ownerAddress)){
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
                        for(let file of resolvedFiles){                 
                            if(file !== undefined){
                                try {
                                    //parse flashloan file
                                    let completeFileName = path.join(directoryPath, file);
                                    let parsedJson = Files.parseJSONtoOjectList(completeFileName);
                                    
                                    //take old Balance of DAI
                                    let erc20ops = new ERC20ops(GLOBAL);
                                    let oldDaiBalance = await erc20ops.getBalanceOfERC20(getERC20("DAI"), FLASHLOAN_ADDRESS);

                                    //execute flashloan
                                    let flashOps = new FlashOps(GLOBAL);
                                    
                                    let response = await flashOps.executeFlashloanAAVEv1(parsedJson);
                                    
                                    //parse response data
                                    if(response){
                                        
                                        //take new balance of DAI
                                        let newDaiBalance = await erc20ops.getBalanceOfERC20(getERC20("DAI"), FLASHLOAN_ADDRESS);

                                        //serialize log file with the execution data
                                        let serializedFile = await Files.serializeFlashloanResult(response, parsedJson, completeFileName, path.join(__dirname, process.env.NETWORKS_FOLDER, GLOBAL.network, process.env.FLASHLOAN_OUTPUT_FOLDER), oldDaiBalance, newDaiBalance);
                                        console.log("##### Flashloan Executed! output file:"+serializedFile.location+" results: #####")
                                        console.log(serializedFile.content.result);
                                        
                                        //remove original input file
                                        if(serializedFile){
                                            console.log("!!!uncoment to delete original file")
                                            //Files.deleteFile(completeFileName);                        
                                        }
                                    } else {
                                        throw("Error: undefined response returned from executeFlashloan function!");
                                    }
                                } catch (error) {
                                    throw (error);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                throw (error);
            }
        
        break;

        case '8.1': 
            console.log("######### Mode 8.1 | VERIFY INPUT FOLDER AND EXECUTE DODO FLASHLOAN #########");
            
            try {
                if(mode.length < 3){
                    throw new Error("Invalid number of parameters! Ex: node .\\Flashloaner.js 8 EthereumForkUpdate Networks\\EthereumForkUpdate\\FlashloanInput");
                }
                if(isContractOk(network, GLOBAL.ownerAddress)){
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
                        for(let file of resolvedFiles){                 
                            if(file !== undefined){
                                try {
                                    //parse flashloan file
                                    let completeFileName = path.join(directoryPath, file);
                                    let parsedJson = Files.parseJSONtoOjectList(completeFileName);
                                    
                                    //take old Balance of DAI
                                    let erc20ops = new ERC20ops(GLOBAL);
                                    let oldDaiBalance = await erc20ops.getBalanceOfERC20(getERC20("DAI"), FLASHLOAN_DODO_ADDRESS);

                                    //execute flashloan
                                    let flashDodoOps = new FlashDodoOps(GLOBAL);
                                    
                                    let response = await flashDodoOps.executeFlashloanDodo(parsedJson);
                                    
                                    //parse response data
                                    if(response){
                                        
                                        //take new balance of DAI
                                        let newDaiBalance = await erc20ops.getBalanceOfERC20(getERC20("DAI"), FLASHLOAN_DODO_ADDRESS);

                                        //serialize log file with the execution data
                                        let serializedFile = await Files.serializeFlashloanResult(response, parsedJson, completeFileName, path.join(__dirname, process.env.NETWORKS_FOLDER, GLOBAL.network, process.env.FLASHLOAN_OUTPUT_FOLDER), oldDaiBalance, newDaiBalance);
                                        console.log("##### Flashloan Executed! output file:"+serializedFile.location+" results: #####")
                                        console.log(serializedFile.content.result);
                                        
                                        //remove original input file
                                        if(serializedFile){
                                            console.log("!!!uncoment to delete original file")
                                            //Files.deleteFile(completeFileName);                        
                                        }
                                    } else {
                                        throw("Error: undefined response returned from executeFlashloan function!");
                                    }
                                } catch (error) {
                                    throw (error);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                throw (error);
            }
        
        break;

        case '8.2': 
            console.log("######### Mode 8.2 | NEW INPUT DODO FLASHLOAN #########");
            
            try {
                if(mode.length < 3){
                    throw new Error("Invalid number of parameters! Ex: node .\\Flashloaner.js 8 EthereumForkUpdate Networks\\EthereumForkUpdate\\FlashloanInput");
                }
                if(isContractOk(network, GLOBAL.ownerAddress)){
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
                        for(let file of resolvedFiles){                 
                            if(file !== undefined){
                                try {
                                    //parse flashloan file
                                    let completeFileName = path.join(directoryPath, file);
                                    let parsedJson = Files.parseJSONtoOjectList(completeFileName);
                                    
                                    //take old Balance of DAI
                                    let erc20ops = new ERC20ops(GLOBAL);
                                    let oldDaiBalance = await erc20ops.getBalanceOfERC20(getERC20("DAI"), FLASHLOAN_NEWINPUT_ADDRESS);

                                    //execute flashloan
                                    let flashNewInputOps = new FlashNewInputOps(GLOBAL);
                                    
                                    let response = await flashNewInputOps.executeFlashloanDodo(parsedJson);
                                    
                                    //parse response data
                                    if(response){
                                        
                                        //take new balance of DAI
                                        let newDaiBalance = await erc20ops.getBalanceOfERC20(getERC20("DAI"), FLASHLOAN_NEWINPUT_ADDRESS);

                                        //serialize log file with the execution data
                                        let serializedFile = await Files.serializeFlashloanResult(response, parsedJson, completeFileName, path.join(__dirname, process.env.NETWORKS_FOLDER, GLOBAL.network, process.env.FLASHLOAN_OUTPUT_FOLDER), oldDaiBalance, newDaiBalance);
                                        console.log("##### Flashloan Executed! output file:"+serializedFile.location+" results: #####")
                                        console.log(serializedFile.content.result);
                                        
                                        //remove original input file
                                        if(serializedFile){
                                            console.log("!!!uncoment to delete original file")
                                            //Files.deleteFile(completeFileName);                        
                                        }
                                    } else {
                                        throw("Error: undefined response returned from executeFlashloan function!");
                                    }
                                } catch (error) {
                                    throw (error);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                throw (error);
            }
        
        break;

        
        case '9': // getPool address on UniswapV3
            try { 
               let uniOps = new UniswapV3ops(GLOBAL);
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
        
        //show main address
        case '10': 
            console.log("######### Mode 10 | SHOW MAIN ADDRESSES #########");
            let ownerFlashloan = await getOwner(network, Flashloan);
            console.log("GLOBAL.ownerAddress: "+GLOBAL.ownerAddress);
            console.log("flashloanAddress: "+FLASHLOAN_ADDRESS);
            console.log("flashloanDodoAddress: "+FLASHLOAN_DODO_ADDRESS);
            console.log("flashloan Owner Address: "+ownerFlashloan);
            console.log("DAItokenAddress: "+getERC20("DAI").address);
            console.log("RPC Provider URL: "+blockchainConfig.network[GLOBAL.network].RPC_PROVIDER_URL);
            let chainId = await GLOBAL.web3Instance.eth.getChainId()
            console.log("chainId = "+chainId);
        break;        
        
        //testes transaction receipt
        case '11':
            let receipt = await GLOBAL.web3Instance.eth.getTransactionReceipt("0xfb1ba919cdaf5e014cfcaa7c7dfa2687d5e19173fe6b88ee1926721fb21834ae");
            console.log(receipt);            
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