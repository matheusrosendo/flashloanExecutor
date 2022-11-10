require("dotenv").config({path: ".env"});
const fs = require("fs");
const path = require("path");
const Web3 = require('web3');
const assert = require('assert');
const Flashloaner = require("./build/contracts/Flashloaner");
const Files = require("./Files.js");
const Util = require("./Util.js");
const UniswapV3ops = require("./UniswapV3ops.js");
const ERC20ops = require("./ERC20ops.js");
const FlashloanerOps = require("./FlashloanerOps.js");
const {BlockchainConfig, getItemFromTokenList, GLOBAL} = require("./BlockchainConfig.js");
const { get } = require("http");
const Spot = require('@binance/connector/src/spot')
const HDWalletProvider = require("@truffle/hdwallet-provider")

Number.prototype.toFixedDown = function(digits) {
    var re = new RegExp("(\\d+\\.\\d{" + digits + "})(\\d)"),
        m = this.toString().match(re);
    return m ? parseFloat(m[1]) : this.valueOf();
};

//global variables
let FLASHLOANER_ADDRESS;


/**
 * Web3 singleton 
 * @returns 
 */
function getWeb3Instance(_network){
    try {       
        if(!GLOBAL.web3Instance){
            GLOBAL.web3Instance = new Web3(new HDWalletProvider(process.env.OWNER_PK, BlockchainConfig.network[_network].BLOCKCHAIN_RPC_FLASHLOANER_PROVIDER));
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
        throw new Error("trying to get block, verify connection with " + BlockchainConfig.network[_network].BLOCKCHAIN_RPC_FLASHLOANER_PROVIDER);
    }
    return blockNumber;
}

async function getCurrentGasPriceInGwei(){
    let gasPriceInGwei;
    try {
        let gasPrice = await GLOBAL.web3Instance.eth.getGasPrice();
        gasPriceInGwei = Web3.utils.fromWei(gasPrice, "gwei");
    } catch (error) {
        throw new Error("trying to get gas price, verify connection with " + BlockchainConfig.network[_network].BLOCKCHAIN_RPC_FLASHLOANER_PROVIDER);
    }
    return gasPriceInGwei;
}

/**
 * Verifies if flashloan contract is properly deployed
 * @param {*} _network 
 * @param {*} _OwnerAddress 
 * @returns 
 */
async function isContractOk(_network, _OwnerAddress){
    try {
        let Web3js = getWeb3Instance(_network);
        
        
        let flashloanerContract = new Web3js.eth.Contract(Flashloaner.abi, Flashloaner.networks[GLOBAL.networkId].address)
        let owner = await flashloanerContract.methods.owner().call(); 
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
        let flashloanContract = new Web3js.eth.Contract(_contract.abi, _contract.networks[GLOBAL.networkId].address)
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
        maxFeePerGas: 100000000000
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
    console.log(`### RPC provider: ${BlockchainConfig.network[GLOBAL.network].BLOCKCHAIN_RPC_FLASHLOANER_PROVIDER} ###`); 
    console.log(`### blockchain: ${GLOBAL.blockchain} ###`); 
    console.log(`### network: ${GLOBAL.network} | block: ${currentBlock} | last gas price: ${gasPriceInGwei} gwei ###\n`); 
}

function setMainGlobalData(_network){
    GLOBAL.network = _network;
    GLOBAL.web3Instance = getWeb3Instance(GLOBAL.network);
    GLOBAL.blockchain = BlockchainConfig.network[GLOBAL.network].BLOCKCHAIN;
    GLOBAL.RPCprovider = BlockchainConfig.network[GLOBAL.network].BLOCKCHAIN_RPC_FLASHLOANER_PROVIDER;
    GLOBAL.ownerAddress = String(process.env.OWNER_ADDRESS);
    GLOBAL.tokenList = BlockchainConfig.blockchain[GLOBAL.blockchain].tokenList;
    GLOBAL.networkId = BlockchainConfig.blockchain[GLOBAL.blockchain].NETWORK_ID;
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
    if(!BlockchainConfig.network[network]){
        throw new Error("invalid network name = "+network);
    }
        
    //set GLOBAL main values
    setMainGlobalData(network)
    
    //show init main information
    await showInitInfo();
    
    // if flashloan address was set in .env, set FLASHLOAN_ADFRESS global variable with it, 
    // or use local deployed contract address otherwise 
    if(BlockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOANER_ADDRESS){
        FLASHLOANER_ADDRESS = BlockchainConfig.blockchain[GLOBAL.blockchain].FLASHLOANER_ADDRESS
    } else {
        FLASHLOANER_ADDRESS = Flashloaner.networks[GLOBAL.networkId].address; 
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

        case '2': //Fund Flashloan new input smart contract with DAI and USDC
            console.log("######### Mode 2 | FUND FLASHLOANER CONTRACT #########");
            try {               
                let erc20ops = new ERC20ops(GLOBAL);
                let balanceDAIowner = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);
                
                if(balanceDAIowner > 1){
                    await erc20ops.transfer( getERC20("DAI"), FLASHLOANER_ADDRESS, Number(balanceDAIowner).toFixedDown(4));
                } else{
                console.error("Warning: no DAI on owner address");
                }

                let balanceUSDCowner = await erc20ops.getBalanceOfERC20(getERC20("USDC"), GLOBAL.ownerAddress);
                if(balanceUSDCowner > 1){
                    await erc20ops.transfer( getERC20("USDC"), FLASHLOANER_ADDRESS, Number(balanceUSDCowner).toFixedDown(4));
                } else{
                console.error("Warning: no USDC on owner address");
                }

                console.log("\n### contract balances: ###");
                await showBalances(FLASHLOANER_ADDRESS); 

            } catch (error) {
                throw(error);
            }
            
        break;

       

        case '3': 
        console.log("######### Mode 3 | FLASHLOANER CONTRACT BALANCES #########");
            try {               
                if(isContractOk(network, GLOBAL.ownerAddress)){
                    console.log("### balances of contract "+FLASHLOANER_ADDRESS+" ###");
                    await showBalances(FLASHLOANER_ADDRESS);
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
        
       

        // execute main flashloan function
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
                                
                                //take old Balance of DAI
                                let erc20ops = new ERC20ops(GLOBAL);
                                let oldDaiBalance = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);

                                //execute flashloan
                                let flashloanerOps = new FlashloanerOps(GLOBAL);
                                if(flashloanerOps.isInputFileOk(parsedJson)){
                                    
                                        
                                    
                                    let serializedFile
                                    
                                    try {
                                        let flashPromise = flashloanerOps.executeFlashloan(parsedJson);
                                    
                                        await flashPromise.then (async (response) =>{
                                                                                    
                                            //calculate transaction cost in ETH
                                            response.txCost = Web3.utils.fromWei(String(response.gasUsed * response.effectiveGasPrice));

                                            //take new balance of DAI
                                            let newDaiBalance = await erc20ops.getBalanceOfERC20(getERC20("DAI"), GLOBAL.ownerAddress);

                                            //serialize log file with the execution data
                                            serializedFile = await Files.serializeFlashloanResult(response, parsedJson, completeFileName, path.join(__dirname, process.env.NETWORKS_FOLDER, GLOBAL.network, process.env.FLASHLOAN_OUTPUT_FOLDER), oldDaiBalance, newDaiBalance);
                                            console.log("##### Results: #####")
                                            console.log(serializedFile.content.result);
                                            
                                            
                                        }).catch (async (error) => {
                                            //serialize log file with the error
                                            serializedFile = await Files.serializeFlashloanResult(error, parsedJson, completeFileName, path.join(__dirname, process.env.NETWORKS_FOLDER, GLOBAL.network, process.env.FLASHLOAN_OUTPUT_FOLDER), oldDaiBalance, oldDaiBalance);
                                            console.log("##### Execution failed: #####")
                                            console.log(error.details);
                                            
                                        }).finally ( () => {
                                            
                                            //remove original input file
                                            if(serializedFile){
                                                //console.log("!!! uncoment to delete original file")
                                                Files.deleteFile(completeFileName);                        
                                            }
                                            console.log("### File moved to output folder ###");
                                        })

                                    } catch (error) {
                                        console.log(`Error executing flashloan error ${error}`);
                                    }                                    
                                } else {
                                    throw("Error: input file is not complete");
                                }
                                
                            }
                        }
                    }
                }
            } catch (error) {
                throw (error);
            }
        
        break;
       
        
        //withdraw DAI to owner
        // Ex: node .\Flashloaner.js 5 networkName
        case '6': 
            try { 
                console.log("######### Mode 6 | WITHDRAW FROM CONTRACT #########");
                let erc20ops = new ERC20ops(GLOBAL);
                let currentContractBalanceDai = await erc20ops.getBalanceOfERC20(getERC20("DAI"), FLASHLOANER_ADDRESS);
                if(currentContractBalanceDai == 0){
                    console.log("There is no DAI in the flashloan contract!")
                } else {
                    let flashloanerOps = new FlashloanerOps(GLOBAL, FLASHLOANER_ADDRESS);
                    let tx = await flashloanerOps.withdrawToken(getERC20("DAI"));
                    console.log(tx.transactionHash);
                }                
                console.log("\n### CONTRACT balances: ###");
                await showBalances(FLASHLOANER_ADDRESS); 

                console.log("\n### OWNER balances: ###");
                await showBalances(GLOBAL.ownerAddress); 
            } catch (error) {
                throw (error);
            }
        break;
        
        //show main address
        case '10': 
            console.log("######### Mode 10 | SHOW MAIN ADDRESSES #########");
            let ownerFlashloan = await getOwner(network, Flashloaner);
            console.log("GLOBAL.ownerAddress: "+GLOBAL.ownerAddress);
            console.log("flashloan Owner Address: "+ownerFlashloan);
            console.log("DAItokenAddress: "+getERC20("DAI").address);
            console.log("RPC Provider URL: "+BlockchainConfig.network[GLOBAL.network].BLOCKCHAIN_RPC_FLASHLOANER_PROVIDER);
            let chainId = await GLOBAL.web3Instance.eth.getChainId()
            console.log("chainId = "+chainId);
        break;        
        
        case '11': // get some pool addresses on UniswapV3
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

        case '12': // get some pool addresses on UniswapV3
            try { 
               console.log("######### Mode 12 | UNISWAPV3 GET AMOUNT OUT LOCAL CALC #########");
               let uniOps = new UniswapV3ops(GLOBAL); 
               console.log("Get amount out 1 WETH -> USDC (0.3)");
               let usdcAmountOut = await uniOps.getAmountOut(1, getERC20("WETH"), getERC20("USDC"), 0.3);
               console.log(usdcAmountOut);               
               //console.log("Get amount out 1 WETH -> USDC (0.05)");
               /* usdcAmountOut = await uniOps.getAmountOut(1000, getERC20("WETH"), getERC20("USDC"), 0.05);
               console.log(usdcAmountOut);
               console.log("Get amount out 1 WETH -> USDC (0.01)");
               usdcAmountOut = await uniOps.getAmountOut(1000, getERC20("WETH"), getERC20("USDC"), 0.01);
               console.log(usdcAmountOut);

               console.log("Get amount out 1600 USDC -> WETH (0.3)");
               let wethAmountOut = await uniOps.getAmountOut(1600, getERC20("USDC"), getERC20("WETH"), 0.3);
               console.log(wethAmountOut);  
               console.log("Get amount out 1600 USDC -> WETH (0.05)");
               wethAmountOut = await uniOps.getAmountOut(1600, getERC20("USDC"), getERC20("WETH"), 0.05);
               console.log(wethAmountOut);
               console.log("Get amount out 1600 USDC -> WETH (0.01)");
               wethAmountOut = await uniOps.getAmountOut(1600, getERC20("USDC"), getERC20("WETH"), 0.01);
               console.log(wethAmountOut); */

            } catch (error) {
                throw (error);
            }
        break

        case '13': // get amount out from pool addresses on UniswapV3
            try { 
               console.log("######### Mode 13 | UNISWAPV3 GET AMOUNT OUT FROM BLOCKCHAIN #########");
               let uniOps = new UniswapV3ops(GLOBAL); 
               
               console.log("Get amount out 1 WETH -> UNI (0.05)");
               try {
                
               } catch (error) {
                
               }
               console.log(await uniOps.queryAmountOut(0.00001, getERC20("WETH"), getERC20("UNI"), 0.05));
               console.log("Get amount out 1 WETH -> UNI (0.3)");
               console.log(await uniOps.queryAmountOut(0.00001, getERC20("WETH"), getERC20("UNI"), 0.3));
               console.log("Get amount out 1 WETH -> UNI (0.01)");
               console.log(await uniOps.queryAmountOut(0.00001, getERC20("WETH"), getERC20("UNI"), 0.01)); 

               console.log("Get amount out 1 UNI -> WETH (0.05)");
               console.log(await uniOps.queryAmountOut(0.0001, getERC20("UNI"), getERC20("WETH"), 0.05));
               console.log("Get amount out 1 UNI -> WETH (0.3)");
               console.log(await uniOps.queryAmountOut(0.0001, getERC20("UNI"), getERC20("WETH"), 0.3));
               console.log("Get amount out 1 UNI -> WETH (0.01)");
               console.log(await uniOps.queryAmountOut(0.0001, getERC20("UNI"), getERC20("WETH"), 0.01));
 

            } catch (error) {
                throw (error);
            }
        break

        case '14': // get FEE of the best amount out
            try { 
               console.log("######### Mode 14 | UNISWAPV3 GET FEE of BEST AMOUNT OUT #########");
               let uniOps = new UniswapV3ops(GLOBAL); 
               
               result = await uniOps.queryFeeOfBestRoute(100, getERC20("WETH"), getERC20("USDT"), []);
               console.log("best fee found:"+result.bestFee); 
               
               console.log("Get amount out 1 WETH -> UNI (0.05)");
               console.log(await uniOps.queryAmountOut(100, getERC20("WETH"), getERC20("UNI"), 0.05));
               console.log("Get amount out 1 WETH -> UNI (0.3)");
               console.log(await uniOps.queryAmountOut(100, getERC20("WETH"), getERC20("UNI"), 0.3));

               console.log("Get amount out 1 UNI -> WETH (0.05)");
               console.log(await uniOps.queryAmountOut(100, getERC20("UNI"), getERC20("WETH"), 0.05));

               console.log("Get amount out 1 UNI -> WETH (0.3)");
               console.log(await uniOps.queryAmountOut(100, getERC20("UNI"), getERC20("WETH"), 0.3));

               console.log("Get amount out 1 UNI -> WETH (0.01)");
               console.log(await uniOps.queryAmountOut(100, getERC20("UNI"), getERC20("WETH"), 0.01));
 

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