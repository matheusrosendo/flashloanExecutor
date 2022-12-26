require("dotenv").config({path: ".env"});
const fs = require("fs");
const path = require("path");
const Web3 = require('web3');
const assert = require('assert');
const Flashloaner = require("./build/contracts/Flashloaner");
const Files = require("./Files.js");
const Util = require("./Util.js");
const UniswapV3ops = require("./UniswapV3ops.js");
const UniswapV2ops = require("./UniswapV2ops.js");
const CurveOps = require("./CurveOps.js");
const ERC20ops = require("./ERC20ops.js");
const FlashloanerOps = require("./FlashloanerOps.js");
const {BlockchainConfig, getItemFromTokenList, getInitialTokenSymbol, GLOBAL} = require("./BlockchainConfig.js");
const { get } = require("http");
const Spot = require('@binance/connector/src/spot')
const HDWalletProvider = require("@truffle/hdwallet-provider")

/**
 * Used to truncate a Number to digits
 * @param {Number} digits 
 * @returns 
 */
Number.prototype.toFixedDown = function(digits) {
    var re = new RegExp("(\\d+\\.\\d{" + digits + "})(\\d)"),
        m = this.toString().match(re);
    return m ? parseFloat(m[1]) : this.valueOf();
};

/**
 * Web3 instance singleton 
 * @returns 
 */
function getWeb3Instance(_network){
    try {       
        if(!GLOBAL.web3Instance){
            GLOBAL.web3Instance = new Web3(new HDWalletProvider(process.env.OWNER_PK, BlockchainConfig.network[_network].RPC_FLASHLOANER_PROVIDER));
            GLOBAL.web3Instance.eth.handleRevert = true;
        }
    } catch (error) {
        throw new Error("Error to connect to "+_network+" error: "+error);
    }
    return  GLOBAL.web3Instance; 
}

/**
 * get latest block number of current blockchain
 * @param {String} _network 
 * @returns Number
 */
async function getCurrentBlock(_network){
    let blockNumber;
    try {
        block = await GLOBAL.web3Instance.eth.getBlock("latest");
        blockNumber = block.number;
    } catch (error) {
        throw new Error("trying to get block, verify connection with " + BlockchainConfig.network[_network].RPC_FLASHLOANER_PROVIDER);
    }
    return blockNumber;
}

/**
 * query current gas price in gwei
 * @returns Number
 */
async function getCurrentGasPriceInGwei(){
    let gasPriceInGwei;
    try {
        let gasPrice = await GLOBAL.web3Instance.eth.getGasPrice();
        gasPriceInGwei = Web3.utils.fromWei(gasPrice, "gwei");
    } catch (error) {
        throw new Error("trying to get gas price, verify connection with " + BlockchainConfig.network[_network].RPC_FLASHLOANER_PROVIDER);
    }
    return gasPriceInGwei;
}

/**
 * Verifies if flashloan contract is properly deployed
 * @param {String} _network 
 * @param {String} _ownerAddress 
 * @returns bool
 */
async function isContractOk(_network, _ownerAddress){
    try {
        let Web3js = getWeb3Instance(_network);
        
        let flashloanerContract = new Web3js.eth.Contract(Flashloaner.abi, GLOBAL.flashloanerDeployedAddressMainnet)
        let owner = await flashloanerContract.methods.owner().call(); 
        if (owner == _ownerAddress){
            return true;
        } else {
            console.log("Error: contract found but owner is not the informed address, owner found = "+owner);
            return false;
        }        
    } catch (error) {
        throw new Error("Are you sure Flashloan Dodo Contract is deployed? Error: "+error);
    }
}

/**
 * Send _amount Main Crypto from _from address to _to address
 * @param {*} _from 
 * @param {*} _to 
 * @param {*} _amount 
 * @param {*} ownerPk 
 * @returns transaction (Promise)
 */
function sendEth(_from, _to, _amount, ownerPk = String(process.env.OWNER_PK)){
    
                
    //handle response tx
    let txPromise = new Promise(async (resolve, reject) =>{            
        try {
            //sets maxFeePerGas and maxPriorityFeePerGas, lesser values were generating 'transaction underpriced' error on Polygon mainnet 
            let maxPriorityFeePerGas = await GLOBAL.web3Instance.eth.getGasPrice();
            let maxFeePerGas = maxPriorityFeePerGas * 3;
            let rawTx = {
                from: _from, 
                to: _to, 
                value: Util.amountToBlockchain(_amount, 18),
                maxFeePerGas: String(maxFeePerGas),
                maxPriorityFeePerGas: String(maxPriorityFeePerGas),
                gasLimit: BlockchainConfig.blockchain[GLOBAL.blockchain].GAS_LIMIT_LOW,
            };
        
            let signedTx = await getWeb3Instance().eth.accounts.signTransaction(rawTx, ownerPk);

            let sentTx = getWeb3Instance().eth.sendSignedTransaction(signedTx.raw || signedTx.rawTransaction); 
            
            sentTx.on("receipt", (receipt) => {
                console.log(`### ${_amount} ${getMainCrypto()} sent successfully: ###`);
                resolve(receipt);
            });
            sentTx.on("error", (err) => {
                console.log("### send tx error: ###");
                reject (err);
            });                    
        } catch (error) {
            reject (error);
        }
    });
    return txPromise;
}

/**
 * Query main crypto balance of given _address
 * @param {String} _address 
 * @returns Number
 */
async function getCryptoBalanceOf(_address){
    let balanceInWei = await GLOBAL.web3Instance.eth.getBalance(GLOBAL.ownerAddress);
    return Util.amountFromBlockchain(balanceInWei, 18);
}

/**
 * Show Main Crypto and some main token balances of given _address 
 * @param {*} _address 
 */
async function showBalances(_address){
    let balanceMainCrypto = await getCryptoBalanceOf(_address);
    console.log(`${getMainCrypto()}: ${balanceMainCrypto} `);

    let erc20ops = new ERC20ops(GLOBAL);     
    let symbolWrapped = getWrappedMainCrypto();
    let balanceWrappedMainCrypto = await erc20ops.getBalanceOfERC20(getERC20(symbolWrapped), _address);
    console.log(`${symbolWrapped}: ${balanceWrappedMainCrypto}`);
    let balanceDAI = await erc20ops.getBalanceOfERC20(getERC20("DAI"), _address);
    console.log(`DAI: ${balanceDAI}`);
    let balanceUSDT = await erc20ops.getBalanceOfERC20(getERC20("USDT"), _address);
    console.log(`USDT: ${balanceUSDT}`);
    let balanceUSDC = await erc20ops.getBalanceOfERC20(getERC20("USDC"), _address);
    console.log(`USDC: ${balanceUSDC}`);
    let balanceWBTC = await erc20ops.getBalanceOfERC20(getERC20("WBTC"), _address);
    console.log(`WBTC: ${balanceWBTC}`);
} 

/**
 * Show initial info (RPC provider, blochain, network, etc)
 */
async function showInitInfo(){
    let currentBlock = await getCurrentBlock(GLOBAL.network);
    let gasPriceInGwei = await getCurrentGasPriceInGwei();
    console.log(`\n### ${Util.formatDateTime(new Date())} ###`); 
    console.log(`### RPC provider: ${BlockchainConfig.network[GLOBAL.network].RPC_FLASHLOANER_PROVIDER} ###`); 
    console.log(`### blockchain: ${GLOBAL.blockchain} ###`); 
    console.log(`### network: ${GLOBAL.network} | block: ${currentBlock} | last gas price: ${gasPriceInGwei} gwei ###\n`); 
}

/**
 * Set main global data used for all interactions with smart contracts
 * @param {*} _network 
 */
function setMainGlobalData(_network){
    GLOBAL.network = _network;
    GLOBAL.web3Instance = getWeb3Instance(GLOBAL.network);
    GLOBAL.blockchain = BlockchainConfig.network[GLOBAL.network].BLOCKCHAIN;
    GLOBAL.RPCprovider = BlockchainConfig.network[GLOBAL.network].RPC_FLASHLOANER_PROVIDER;
    GLOBAL.ownerAddress = String(process.env.OWNER_ADDRESS);
    GLOBAL.ownerPK = String(process.env.OWNER_PK);
    GLOBAL.tokenList = BlockchainConfig.blockchain[GLOBAL.blockchain].tokenList;
    GLOBAL.networkId = BlockchainConfig.blockchain[GLOBAL.blockchain].NETWORK_ID;
    //set deployed address contained in .env file, in case it is not set, flashloaner address will be the local deployed address
    if (BlockchainConfig.network[GLOBAL.network].FLASHLOANER_MAINNET_ADDRESS){
        GLOBAL.flashloanerDeployedAddressMainnet = BlockchainConfig.network[GLOBAL.network].FLASHLOANER_MAINNET_ADDRESS
    } else {
        GLOBAL.flashloanerDeployedAddressMainnet = Flashloaner.networks[GLOBAL.networkId].address
    }
}

/**
 * alias to getItemFromTokenList
 * @param {*} _symbol 
 * @returns 
 */
function getERC20(_symbol){
    return getItemFromTokenList("symbol", _symbol, GLOBAL.tokenList);
}

/**
 * Take a path and make all swaps until the and keeping reserves, prices and slipage
 * @param {*} _pool3Instance 
 * @param {*} _path 
 * @param {*} _initialAmountUSD 
 * @param {*} _fromLocal 
 * @returns 
 */
 async function verifyAmountOut (_parsedJson){
    let amountIn = _parsedJson.initialTokenAmount
    let lastAmount = 0;
    let curveOps = new CurveOps(GLOBAL);
    let uniswapV2ops = new UniswapV2ops(GLOBAL);
    let uniswapV3ops = new UniswapV3ops(GLOBAL);
    let erc20ops = new ERC20ops(GLOBAL);
    for(let swap of _parsedJson.flashloanInputData.swaps){
        if (swap.tokenInAddress !== swap.tokenOutAddress){
            let tokenInDecimals = await erc20ops.getDecimals(swap.tokenInAddress);
            let tokenIn = {address: swap.tokenInAddress, decimals: tokenInDecimals};
            let tokenOutDecimals = await erc20ops.getDecimals(swap.tokenOutAddress);
            let tokenOut = {address: swap.tokenOutAddress, decimals: tokenOutDecimals};
            //verify if tokens in and out are diferent 
        
            switch (swap.protocolTypeIndex) {
                case 1: // Curve type
                    lastAmount = await curveOps.queryAmountOut(swap.routerAddress, amountIn, tokenIn, tokenOut);
                break;
                case 2: // UniswapV2 type
                    lastAmount = await uniswapV2ops.queryAmountOut(swap.routerAddress, amountIn, tokenIn, tokenOut);
                break;
                case 3: // UniswapV3 type
                    lastAmount = await uniswapV3ops.queryAmountOut(BlockchainConfig.blockchain[GLOBAL.blockchain].UNISWAPV3_QUOTER_ADDRESS, amountIn, tokenIn, tokenOut, swap.fee / (10**4));
                break;
                default:
                    throw("invalid protocol type");
                break;
            }
        }
        amountIn = lastAmount; 
    }

    return lastAmount;
}

/**
 * Get Main Crypto symbol according to current blockchain (Ethereum or Polygon)
 * @returns String
 */
function getMainCrypto(){
    if(GLOBAL.blockchain == "ethereum"){
        return "ETH";
    } else if (GLOBAL.blockchain == "polygon"){
        return "MATIC";
    } else {
        throw new Error ("blockchain not set in GLOBAL object");
    }
}

/**
 * Get symbol of Wrapped Main Crypto of current blockchain
 * @returns 
 */
function getWrappedMainCrypto(){
    return "W"+getMainCrypto();
}

/**
 * Used to fund smart contract with Main Crypto 
 * @returns Number
 */
function getInitialFundsMainCrypto(){
    try {
        
        if(GLOBAL.blockchain == "ethereum"){
            return parseInt(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK);
        } else if (GLOBAL.blockchain == "polygon"){
            return parseInt(process.env.WMATIC_AMOUNT_INITIAL_FUND_ON_FORK);
        } else {
            throw new Error ("blockchain not set in GLOBAL object");
        }
    } catch (error) {
        throw new Error ("initial funds not found on .env file");    
    }
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
    if(!BlockchainConfig.network[network]){
        throw new Error("invalid network name = "+network);
    }
        
    //set GLOBAL main values
    setMainGlobalData(network)
    
    //show init main information
    await showInitInfo();
         
    switch(mode[0]){
        case '1': //FORK LOCAL DEV ONLY: exchange some Crypto by Wrapped Crypto, then WCRYPTO by DAI, and DAI by USDC on UniswapV3
            try{
                let symbolWrappedMainCrypto = getWrappedMainCrypto();
                let wrappedMainCrypto = getERC20(symbolWrappedMainCrypto);    
                console.log(`######### Mode 1 | ${getMainCrypto()} -> ${symbolWrappedMainCrypto} | ${symbolWrappedMainCrypto} -> DAI | DAI -> USDC #########`);
                //get weth address, to convert eth to weth just send eth to weth contract address, since it has a payable function that calls deposit function inside
                let amountMainCrypto = getInitialFundsMainCrypto();
                await sendEth(GLOBAL.ownerAddress, wrappedMainCrypto.address, amountMainCrypto);

                //get Wrapped crypto balance
                let erc20ops = new ERC20ops(GLOBAL);
                let balanceWrappedMainCrypto = await erc20ops.getBalanceOfERC20(getERC20(getWrappedMainCrypto()), GLOBAL.ownerAddress);
                console.log(`initial balance wrapped crypto ${balanceWrappedMainCrypto}`);

                //exchange Wrapped crypto by DAI
                let uniOps = new UniswapV3ops(GLOBAL);
                await uniOps.swap(balanceWrappedMainCrypto, getERC20(getWrappedMainCrypto()), getERC20("DAI"), 0.05);

                //exchange half of DAI to USDC 
                let balanceDAI = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);
                await uniOps.swap(balanceDAI/2, getERC20("DAI"), getERC20("USDC"), 0.01);
                console.log("\n### owner balances: ###");
                await showBalances(GLOBAL.ownerAddress);
            } catch (error) {
                throw(error);
            }
            
        break;

        case '2': //FORK LOCAL DEV ONLY: Fund Flashloan new input smart contract with DAI and USDC
            console.log("######### Mode 2 | FUND FLASHLOANER CONTRACT #########");
            try {               
                let erc20ops = new ERC20ops(GLOBAL);
                let balanceDAIowner = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);
                
                if(balanceDAIowner > 1){
                    await erc20ops.transfer( getERC20("DAI"), GLOBAL.flashloanerDeployedAddressMainnet, Number(balanceDAIowner).toFixedDown(4));
                } else{
                console.error("Warning: no DAI on owner address");
                }

                let balanceUSDCowner = await erc20ops.getBalanceOfERC20(getERC20("USDC"), GLOBAL.ownerAddress);
                if(balanceUSDCowner > 1){
                    await erc20ops.transfer( getERC20("USDC"), GLOBAL.flashloanerDeployedAddressMainnet, Number(balanceUSDCowner).toFixedDown(4));
                } else{
                console.error("Warning: no USDC on owner address");
                }

                console.log("\n### contract balances: ###");
                await showBalances(GLOBAL.flashloanerDeployedAddressMainnet); 

            } catch (error) {
                throw(error);
            }
            
        break;

        // check flashloaner contract balances
        // Ex: node .\Flashloaner.js 3 NETWORKNAME
        case '3': 
        console.log("######### Mode 3 | FLASHLOANER CONTRACT BALANCES #########");
            try {               
                if(isContractOk(network, GLOBAL.ownerAddress)){
                    console.log("### balances of contract "+GLOBAL.flashloanerDeployedAddressMainnet+" ###");
                    await showBalances(GLOBAL.flashloanerDeployedAddressMainnet);
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
        
       

        // Main flashloan function: it reads the input flashloan file and verifies the current amount out of the route before executing it. 
        // ex: node .\Flashloaner.js 5 EthereumForkSpecBlock Networks\EthereumForkSpecBlock\FlashloanInput
        case '5': 
            console.log("######### Mode 5 | FLASHLOANER MAIN #########");
            
            try {
                if(mode.length < 3){
                    throw new Error("Invalid number of parameters! Ex: node .\\Flashloaner.js 5 EthereumForkUpdate Networks\\EthereumForkUpdate\\FlashloanInput");
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
                                
                                //parse flashloan file
                                let completeFileName = path.join(directoryPath, file);
                                let parsedJson = Files.parseJSONtoOjectList(completeFileName);
                                console.log("##### Processing new file: "+file+" #####")
                                
                                //instantiate classes and take old Balance of initial token
                                let erc20ops = new ERC20ops(GLOBAL);
                                let initialTokenSymbol = getInitialTokenSymbol(parsedJson);
                                let initialToken = getERC20(initialTokenSymbol)
                                let oldDaiBalance = await erc20ops.getBalanceOfERC20(initialToken, GLOBAL.ownerAddress);
                                let flashloanerOps = new FlashloanerOps(GLOBAL);                                
                                let serializedFile;

                                //first verify input file
                                let verifiedObject = flashloanerOps.isInputFileOk(parsedJson);
                                if(!verifiedObject.isOk){
                                    let result = {
                                        status: "not executed",
                                        details: verifiedObject.message,
                                    }
                                    parsedJson.result = result;
                                    console.log(`### FLASHLOAN ABORTED: verify input file: ###`);
                                    console.log(verifiedObject.message);
                                    serializedFile = await Files.serializeFlashloanResult(null, parsedJson, completeFileName, path.join(__dirname, process.env.NETWORKS_FOLDER, GLOBAL.network, process.env.FLASHLOAN_OUTPUT_FOLDER, process.env.FLASHLOAN_FOLDER_FAILED), oldDaiBalance, oldDaiBalance);
                                } else {
                                    
                                    try {
                                        //verify amount out of path first
                                        let verifiedAmount = await verifyAmountOut(parsedJson);
                                        if(verifiedAmount < parsedJson.initialTokenAmount){
                                            let result = {
                                                block: await getCurrentBlock(GLOBAL.network),
                                                status: "not executed",
                                                details: `verified amount out: ${verifiedAmount} less than initial amount: ${parsedJson.initialTokenAmount} `,
                                            }
                                            parsedJson.result = result;
                                            console.log(`### FLASHLOAN ABORTED: verified amount out (${Number(verifiedAmount).toFixed(2)}) inferior to initial amount ${parsedJson.initialTokenAmount}} ###`);
                                            serializedFile = await Files.serializeFlashloanResult(null, parsedJson, completeFileName, path.join(__dirname, process.env.NETWORKS_FOLDER, GLOBAL.network, process.env.FLASHLOAN_OUTPUT_FOLDER, process.env.FLASHLOAN_FOLDER_FAILED), oldDaiBalance, oldDaiBalance);
                                        } else {

                                            //execute flashloan
                                            let flashPromise = flashloanerOps.executeFlashloan(parsedJson);                                        
                                            await flashPromise.then (async (response) =>{
                                                                                        
                                                //calculate transaction cost in ETH
                                                response.txCost = Web3.utils.fromWei(String(response.gasUsed * response.effectiveGasPrice));

                                                //take new balance of DAI
                                                let newDaiBalance = await erc20ops.getBalanceOfERC20(initialToken, GLOBAL.ownerAddress);

                                                //serialize log file with the execution data
                                                serializedFile = await Files.serializeFlashloanResult(response, parsedJson, completeFileName, path.join(__dirname, process.env.NETWORKS_FOLDER, GLOBAL.network, process.env.FLASHLOAN_OUTPUT_FOLDER), oldDaiBalance, newDaiBalance);
                                                console.log("##### Results: #####")
                                                console.log(serializedFile.content.result);
                                            }).catch (async (error) => {
                                                //serialize log file with the error
                                                error.blockNumber = await getCurrentBlock(GLOBAL.network);
                                                serializedFile = await Files.serializeFlashloanResult(error, parsedJson, completeFileName, path.join(__dirname, process.env.NETWORKS_FOLDER, GLOBAL.network, process.env.FLASHLOAN_OUTPUT_FOLDER, process.env.FLASHLOAN_FOLDER_FAILED), oldDaiBalance, oldDaiBalance);
                                                console.log("##### Execution failed: #####")
                                                console.log(error);
                                            })
                                        }
                                    } catch (error) {
                                        console.log(`Error executing flashloan error ${error}`);
                                    } 
                                } 
                                
                                //remove original input file
                                if(serializedFile){
                                    //console.log("!!! uncoment to delete original file")
                                    Files.deleteFile(completeFileName);                        
                                }
                                console.log("### File moved to output folder ###");
                                
                                
                            }
                        }
                    }
                }
            } catch (error) {                
                throw (error);
            }
        
        break;
       
        //POLYGON LOCAL DEV ONLY: exchange Main Crypto MATIC by WMATIC, then WMATIC by WBTC on quickswap
        // ex: node .\Flashloaner.js 6 ExamplePolygonBlock
        case '6': 
            try {
                //amount of wraped to ken to be exchanged 
                let amountWrapedTokenIn = 900;
                let tokenTo = getERC20("WBTC");
                console.log(`######### Mode 6 | Exchange ${amountWrapedTokenIn} MATIC -> WMATIC -> WBTC on Quickswap #########`);

                //instatiate quickswap dex
                let DEX = {
                    name: "quickswap", 
                    routerContractAddress: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", 
                    factoryContractAddress: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32",
                    routerABI:BlockchainConfig.blockchain[GLOBAL.blockchain].UNISWAPV2_ROUTER_ABI,
                    factoryABI:BlockchainConfig.blockchain[GLOBAL.blockchain].UNISWAPV2_FACTORY_ABI
                }

                //exchange crypto by wrapped crypto
                let symbolWrappedMainCrypto = getWrappedMainCrypto();
                let wrappedMainCrypto = getERC20(symbolWrappedMainCrypto); 
                await sendEth(GLOBAL.ownerAddress, wrappedMainCrypto.address, amountWrapedTokenIn); 
                await showBalances(GLOBAL.ownerAddress)  

                //exchange wrapped crypto by defined token above
                let erc20Ops = new ERC20ops(GLOBAL);         
                let uniOps = new UniswapV2ops(GLOBAL); 
                await uniOps.swap(DEX, amountWrapedTokenIn, wrappedMainCrypto, tokenTo)  
                console.log("### owner balances: ###")
                console.log(` ${wrappedMainCrypto.symbol} balance ${await erc20Ops.getBalanceOfERC20(wrappedMainCrypto, GLOBAL.ownerAddress)}`);
                console.log(`${tokenTo.symbol} balance ${await erc20Ops.getBalanceOfERC20(tokenTo, GLOBAL.ownerAddress)}`);
                

            } catch (error) {
                throw (error);
            }
        break;
        
        
        // Used for a simple interaction test to deployed smart contract. It sends 50 cents in USDC from owner address to contract address 
        // Ex: node .\Flashloaner.js 7 PolygonMainnet1
        case '7': 
            try { 
                console.log("######### Mode 7 | SEND USDC TO CONTRACT #########");
                let erc20ops = new ERC20ops(GLOBAL);
                let amountToSend = 0.50;
                let tokenUSDC = getERC20("USDC");
                let currentOwnerBalance = await erc20ops.getBalanceOfERC20(tokenUSDC, GLOBAL.ownerAddress);
                if(currentOwnerBalance == 0){
                    console.log("There is no USDC in the owner account!")
                } else {
                    await erc20ops.transfer(tokenUSDC, GLOBAL.flashloanerDeployedAddressMainnet, amountToSend).then((receipt)=>{
                        console.log("USDC sent successfully");
                        console.log(receipt.transactionHash);
                    }).catch((failedTx)=>{
                        console.log("Failed transaction:");
                        console.log(failedTx);
                    }).finally(async ()=>{
                        let contractBalance = await erc20ops.getBalanceOfERC20(tokenUSDC, GLOBAL.flashloanerDeployedAddressMainnet);
                        console.log("\n### CONTRACT balance (USDC): ###");
                        console.log(contractBalance);

                        let newOwnerBalance = await erc20ops.getBalanceOfERC20(tokenUSDC, GLOBAL.ownerAddress);
                        console.log("\n### OWNER balance (USDC): ###");
                        console.log(newOwnerBalance); 
                    })                    
                }                
                
            } catch (error) {
                throw (error);
            }
        break;

        // Used for a simple interaction test to deployed smart contract. It withdraws all USDC contained in the flashloaner contract back to owner account address
        // Ex: node .\Flashloaner.js 8 PolygonMainnet1
        case '8': 
            try { 
                console.log("######### Mode 8 | WITHDRAW USDC FROM CONTRACT #########");
                let erc20ops = new ERC20ops(GLOBAL);
                let flashloanOps = new FlashloanerOps(GLOBAL);
                let tokenUSDC = getERC20("USDC");
                let currentContractBalance = await erc20ops.getBalanceOfERC20(tokenUSDC, GLOBAL.flashloanerDeployedAddressMainnet);
                if(currentContractBalance == 0){
                    console.log("There is no USDC in the flashloan contract!")
                } else {
                    await flashloanOps.withdrawToken(tokenUSDC).then((receipt)=>{
                        console.log("USDC withdrawn successfully");
                        console.log(receipt.transactionHash);
                    }).catch((failedTx)=>{
                        console.log("Failed transaction:");
                        console.log(failedTx);
                    }).finally(async ()=>{
                        let contractBalance = await erc20ops.getBalanceOfERC20(tokenUSDC, GLOBAL.flashloanerDeployedAddressMainnet);
                        console.log("\n### CONTRACT balance (USDC): ###");
                        console.log(contractBalance);

                        let newOwnerBalance = await erc20ops.getBalanceOfERC20(tokenUSDC, GLOBAL.ownerAddress);
                        console.log("\n### OWNER balance (USDC): ###");
                        console.log(newOwnerBalance); 
                    }) 
                }                
            } catch (error) {
                throw (error);
            }
        break;

        // Withdraws wrapped crypto back to main crypto
        // Ex: node .\Flashloaner.js 8 PolygonMainnet1
        case '9': 
            try { 
                console.log("######### Mode 9 | EXCHANGE WRAPPED CRYPTO (ERC20) BACK TO MAIN CRYPTO  #########");
                let erc20ops = new ERC20ops(GLOBAL);
                let amountIn = 0.1;
                let wrappedCryptoSymbol = getWrappedMainCrypto();
                let wrappedCrypto = getERC20(wrappedCryptoSymbol);
                let currentBalance = await erc20ops.getBalanceOfERC20(wrappedCrypto, GLOBAL.ownerAddress);
                if(currentBalance == 0){
                    console.log(`There is no ${wrappedCrypto.symbol} in the owner balance!`)
                } else {
                    await erc20ops.withdrawCryptofromWrappedCrypto(amountIn, wrappedCrypto).then((receipt)=>{
                        console.log(`${wrappedCrypto.symbol} withdrawn successfully`);
                        console.log(receipt.transactionHash);
                    }).catch((failedTx)=>{
                        console.log("Failed transaction:");
                        console.log(failedTx);
                    }).finally(async ()=>{
                        await showBalances(GLOBAL.ownerAddress)   
                    }) 
                }                
            } catch (error) {
                throw (error);
            }
        break;




        //show some main address
        case '10': 
            console.log("######### Mode 10 | SHOW MAIN ADDRESSES #########");
            let flashOps = new FlashloanerOps(GLOBAL);
            let ownerFlashloan = await flashOps.getOwner();
            console.log("GLOBAL.ownerAddress: "+GLOBAL.ownerAddress);
            console.log("Flashloan Owner Address: "+ownerFlashloan);
            console.log("DAItokenAddress: "+getERC20("DAI").address);
            console.log("RPC Provider URL: "+BlockchainConfig.network[GLOBAL.network].RPC_FLASHLOANER_PROVIDER);
            let chainId = await GLOBAL.web3Instance.eth.getChainId()
            console.log("ChainId = "+chainId);
        break;        
        
        //get some pool addresses on UniswapV3
        case '11': 
            try { 
                console.log("######### Mode 11 | SHOW SOME UNISWAPV3 POOL ADDRESS #########");
               let uniOps = new UniswapV3ops(GLOBAL);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("USDC"), 1);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("USDC"), 0.3);               
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("USDC"), 0.05);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("USDC"), 100);

               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("DAI"), 1);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("DAI"), 0.3);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("DAI"), 0.05);
               await uniOps.showPoolAddress(getERC20("WETH"), getERC20("DAI"), 0.01);

               await uniOps.showPoolAddress(getERC20("USDC"), getERC20("DAI"), 1);
               await uniOps.showPoolAddress(getERC20("USDC"), getERC20("DAI"), 0.3);
               await uniOps.showPoolAddress(getERC20("USDC"), getERC20("DAI"), 0.05);
               await uniOps.showPoolAddress(getERC20("USDC"), getERC20("DAI"), 0.01);
            } catch (error) {
                throw (error);
            }
        break
        
                
        // compare amount out using diferent fees on UniswapV3
        case '13': 
            try { 
               console.log("######### Mode 13 | UNISWAPV3 GET AMOUNT OUT and BEST FEE #########");
               let uniOps = new UniswapV3ops(GLOBAL); 
               
               console.log("Get amount out 1 WETH -> USDT (0.05)");
               console.log(await uniOps.queryAmountOut(BlockchainConfig.blockchain[GLOBAL.blockchain].UNISWAPV3_QUOTER_ADDRESS, 1000, getERC20("WETH"), getERC20("USDT"), 0.05));
               console.log("Get amount out 1 WETH -> USDT (0.3)");
               console.log(await uniOps.queryAmountOut(BlockchainConfig.blockchain[GLOBAL.blockchain].UNISWAPV3_QUOTER_ADDRESS, 1000, getERC20("WETH"), getERC20("USDT"), 0.3));
               console.log("Best fee:");
               console.log(await uniOps.queryFeeOfBestRoute(BlockchainConfig.blockchain[GLOBAL.blockchain].UNISWAPV3_QUOTER_ADDRESS, 1000, getERC20("WETH"), getERC20("USDT"))); 
 

            } catch (error) {
                throw (error);
            }
        break
        
        // get chain ID
        case '16': 
            try { 
                console.log("######### Mode 16 | chain ID #########");
                let flashloanerContract = new FlashloanerOps(GLOBAL);            
                let chainId = await flashloanerContract.getChainId();                        
                console.log(`chainId: ${chainId}`);
            } catch (error) {
                throw (error);
            }
        break
        
        
        

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