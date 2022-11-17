require("dotenv").config({path: ".env"});
const path = require("path");
const Web3 = require('web3');
const Files = require("./Files.js");
const Util = require("./Util.js");
const {BlockchainConfig} = require("./BlockchainConfig.js");
const HDWalletProvider = require("@truffle/hdwallet-provider")

//global variables
let GLOBAL = {
    web3Instance: null,
    network: null,
    blockchain: null,
    ownerAddress: null,
    tokenList: null,
    networkId: null
}

/**
 * Web3 singleton 
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

async function showInitInfo(){
    let currentBlock = await getCurrentBlock(GLOBAL.network);
    let gasPriceInGwei = await getCurrentGasPriceInGwei();
    console.log(`\n### ${Util.formatDateTime(new Date())} ###`); 
    console.log(`### RPC provider: ${BlockchainConfig.network[GLOBAL.network].RPC_FLASHLOANER_PROVIDER} ###`); 
    console.log(`### blockchain: ${GLOBAL.blockchain} ###`); 
    console.log(`### network: ${GLOBAL.network} | block: ${currentBlock} | last gas price: ${gasPriceInGwei} gwei ###\n`); 
}

(async () => {
    console.time('Total Execution Time');    
    console.log("\n######################### START LOGBLOCK EXECUTION #########################");

    //read and verify arguments
    let mode = process.argv.filter((item, index) =>{return index >= 1})
    if(mode.length < 1){
        throw new Error("Error invalid call, lacks network name. Ex: Node .\\LogBlock.js networkName ");
    }

    //set network and some variables used to transfer initial amounts to contract and dev account (local forks only)
    let network = mode[1];
    if(!BlockchainConfig.network[network].RPC_FLASHLOANER_PROVIDER){
        throw new Error("invalid network name = "+network);
    }
        
    //set GLOBAL main values
    GLOBAL.web3Instance = getWeb3Instance(network);
    GLOBAL.blockchain = BlockchainConfig.network[network].BLOCKCHAIN;
    GLOBAL.network = network;
    GLOBAL.ownerAddress = String(process.env.OWNER_ADDRESS); ;
    GLOBAL.tokenList = BlockchainConfig.blockchain[GLOBAL.blockchain].tokenList;
    await showInitInfo();

    try {

        let logPath = path.join(__dirname, process.env.NETWORKS_FOLDER, network, "database", Util.formatDateTimeForFilename(new Date())+".log");
        let logContent = {};
        logContent.network = network;
        logContent.datetime = Util.formatDateTime(new Date());
        //the block just forked is one behind
        let currentBlock = await getCurrentBlock(GLOBAL.network);
        logContent.block = currentBlock-1;
        logContent.rpc = BlockchainConfig.network[network].RPC_FLASHLOANER_PROVIDER;
        if(!Files.fileExists(logPath)){
            await Files.serializeObjectListToLogFile(logPath, logContent);
        }   
    } catch (error) {
        throw (error);
    }         
    
    console.timeEnd('Total Execution Time');
    console.log("######################### END LOGBLOCK EXECUTION #########################\n");
    process.exit();
    
})();