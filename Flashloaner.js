const fs = require("fs");
const path = require("path");
const Web3 = require('web3');
const Flashloan = require("./build/contracts/FlashloanAAVEv1");
const truffleConfig = require("./truffle-config.js");
const Files = require("./Files.js");
const Util = require("./Util.js");

//global variables
let web3Instance;

function exit(){
    process.exit();
}



/**
 * Web3 singleton 
 * @returns 
 */
function getWeb3Instance(_network){
    try {       
        if(web3Instance === undefined){
            web3Instance = new Web3("http://"+truffleConfig.networks[_network].host+":"+truffleConfig.networks[_network].port);
        }
    } catch (error) {
        console.log("Error to connect to "+_network+" "+error);  
    }
    return  web3Instance; 
}


async function serializeResult(_response, _parsedJson, _inputFileName, _network){
    let serializedFile;

    try {
        //get result data
        let result = {
            tx: _response.transactionHash,
            blockNumber: _response.blockNumber,
            tokenBorrowed: _parsedJson.addressPath[1],
            oldBalance: _response.events.LoggerBalance.returnValues.oldBalance,
            newBalance: _response.events.LoggerBalance.returnValues.newBalance,
            profit: (parseInt(_response.events.LoggerBalance.returnValues.newBalance) - parseInt(_response.events.LoggerBalance.returnValues.oldBalance)) / Math.pow(10, parseInt(_parsedJson.initialTokenDecimals))
        }
        _parsedJson.result = result;
        
        //define new file name and serialize it
        let originalFileArr = _inputFileName.split("\\");
        let originalFileName = originalFileArr[originalFileArr.length-1];
        let newFileName = originalFileName.split(".")[0];
        newFileName = newFileName + "_exec_"+Util.formatTimeForFileName(new Date())+".json";
        let fileNameEntirePath = path.join(_network, process.env.FLASHLOAN_LOGS, newFileName);
        await Files.serializeObjectListToJson(fileNameEntirePath, _parsedJson);
        serializedFile = Files.parseJSONtoOjectList(fileNameEntirePath);
    } catch (error) {
        console.log("Error serializing file "+_inputFileName);  
    }
    return serializedFile;
}

async function executeFlashloan (network, parsedJson){
    console.log("### Executing flashloan on "+network+" of $"+parsedJson.initialAmountInUSD+" to path "+parsedJson.path+" ###"); 
    let Web3js = getWeb3Instance(network);
    
    let amountToBorrowOfFirstToken = Web3.utils.toWei(parseFloat(parsedJson.initialTokenAmount).toString());
    let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, Flashloan.networks[truffleConfig.networks[network].network_id].address, { from: truffleConfig.networks[network].DEV_ADDRESS })
    let FlashloanRawTx = {
        from: truffleConfig.networks[network].DEV_ADDRESS,
        chainId:truffleConfig.networks[network].network_id,
        gasLimit: 12000000,
        gasPrice: 0
    };
    let response = await flashloanContract.methods.flashloanUniswapV2(amountToBorrowOfFirstToken, parsedJson.addressPath).send(FlashloanRawTx);        
    return response;             
}

function executeFlashloanPromisse (network, parsedJson){
    console.log("### Executing flashloan on "+network+" of $"+parsedJson.initialAmountInUSD+" to path "+parsedJson.path+" ###"); 
    let Web3js = getWeb3Instance(network);
    
    let amountToBorrowOfFirstToken = Web3.utils.toWei(parseFloat(parsedJson.initialTokenAmount).toString());
    let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, Flashloan.networks[truffleConfig.networks[network].network_id].address, { from: truffleConfig.networks[network].DEV_ADDRESS })
    let FlashloanRawTx = {
        from: truffleConfig.networks[network].DEV_ADDRESS,
        chainId:truffleConfig.networks[network].network_id,
        gasLimit: 12000000,
        gasPrice: 0
    };
    return flashloanContract.methods.flashloanUniswapV2(amountToBorrowOfFirstToken, parsedJson.addressPath).send(FlashloanRawTx);                     
}


(async () => {
    console.time('Total Execution Time');    
    console.log("######################### START FLASHLOAN EXECUTION #########################");

    //read arguments
    let mode = process.argv.filter((item, index) =>{return index >= 2})
    let network;
    let Web3js;
    let DAIcontract, DAIcontractABI, network_id, DAItokenAddress, DaiAmountFromRich, EthAmountFromRich;
    let flashloanAddress;

    //from 0 to 5 it expect the name of the network as second parameter
    if(parseInt(mode[0]) <= 5){
        network = mode[1];
        if(truffleConfig.networks[network] == undefined){
            throw("Error: invalid network name = "+network);
        }
        console.log("### network: "+network+" ###"); 
        Web3js = getWeb3Instance(network);

        //set some variables used to transfer initial amounts to contract and dev account (local forks only)
        DAIcontract;  
        DAIcontractABI = truffleConfig.networks[network].DAIabi;
        network_id = truffleConfig.networks[network].network_id;
        DAItokenAddress = truffleConfig.networks[network].DAIcontract;   
        flashloanAddress = Flashloan.networks[network_id].address;    
        DaiAmountFromRich = '10000';
        EthAmountFromRich = '2';
    }

   

    switch(mode[0]){
        case '1': //get some ETH from a rich account and send to dev and flashloan contract  (development mode only)
         
            //send ETH from rich account to my dev account
            await Web3js.eth.sendTransaction({
                from: truffleConfig.networks[network].RICH_ADDRESS, 
                to: truffleConfig.networks[network].DEV_ADDRESS , 
                value: Web3.utils.toWei(EthAmountFromRich)
            })

            //send ETH from rich account to smart contract
            await Web3js.eth.sendTransaction({
                from: truffleConfig.networks[network].RICH_ADDRESS, 
                to: flashloanAddress, 
                value: Web3.utils.toWei(EthAmountFromRich)
            })
            
            //send DAI from rich account to my dev account
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: truffleConfig.networks[network].RICH_ADDRESS })
            var rawTransaction = {
                from: truffleConfig.networks[network].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(truffleConfig.networks[network].DEV_ADDRESS , Web3.utils.toWei(DaiAmountFromRich)).encodeABI(),
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
                from: truffleConfig.networks[network].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(flashloanAddress, Web3.utils.toWei(DaiAmountFromRich)).encodeABI(),
                gas: 200000,
                chainId: network_id
            };            
            await Web3js.eth.sendTransaction(rawTransaction, (error, receipt) => {
                if (error) {
                    console.log('DEBUG - error in _sendToken ', error)
                }
                console.log(receipt);
            });
            console.log("### ETH and DAI sent ###");
            exit()
            
        break;
        
        case '2': //Fund Flashloan smart contract with DAI
            //get some DAI from a rich account  (development mode only)
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: truffleConfig.networks[network].RICH_ADDRESS })
            
            //send DAI from rich account to flashloan contract
            var rawTransaction = {
                from: truffleConfig.networks[network].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(flashloanAddress, Web3.utils.toWei(DaiAmountFromRich)).encodeABI(),
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

        case '3': //check flashloan contract DAI and ETH balances
            console.log("### balances of contract "+flashloanAddress+" ###");
            //check balance of DAI in the Flashloan Smartcontract
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: truffleConfig.networks[network].DEV_ADDRESS });
            let DAIbalanceFlashloanContract = await DAIcontract.methods.balanceOf(flashloanAddress).call();
            console.log("DAIbalanceFlashloanContract (DAI)= " + Web3.utils.fromWei(DAIbalanceFlashloanContract));
            console.log("DAIbalanceFlashloanContract (Wei DAI)= " + DAIbalanceFlashloanContract);
 
            let ETHbalanceFlashloanContract = await Web3js.eth.getBalance(flashloanAddress);
            console.log("ETHbalanceFlashloanContract = " + Web3.utils.fromWei(ETHbalanceFlashloanContract));
            exit();

        break;

        case '4': //check dev account DAI and ETH balances
            console.log("### balances of account "+truffleConfig.networks[network].DEV_ADDRESS+" ###");   
            //check balance of DAI in the Flashloan Smartcontract
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: truffleConfig.networks[network].RICH_ADDRESS });
            let DAIbalanceDevAccount = await DAIcontract.methods.balanceOf(truffleConfig.networks[network].DEV_ADDRESS).call();
            console.log("DAIbalanceDevAccount = " + Web3.utils.fromWei(DAIbalanceDevAccount));

            let ETHbalanceDevAccount = await Web3js.eth.getBalance(truffleConfig.networks[network].DEV_ADDRESS);
            console.log("ETHbalanceDevAccount = " + Web3.utils.fromWei(ETHbalanceDevAccount));
            exit();
        break;

        case '7': //execute flash loan reading from a specific file
            try {
                let parsedJson = Files.parseJSONtoOjectList(mode[1]);
                if(parsedJson == undefined){
                    throw("Error: file not found "+mode[1]);
                }
                network = parsedJson.network;
                
                let response = await executeFlashloan(network, parsedJson);
                let serializedFile = await serializeResult(response, parsedJson, mode[1], network);
                console.log(serializedFile.result);
                //remove original input file
                if(serializedFile){
                    Files.deleteFile(mode[1]);
                }
                
            } catch (error) {
                console.log("Error: "+error);
            }
        
        break;
        
        case '8': //search for a new file on flashloan input folder and execute it
            try {
                //search for files on the given folder name passed as parameter
                const directoryPath = path.join(__dirname, mode[1]);
                
                let filePromise = new Promise ((resolve, reject)=>{
                    fs.readdir(directoryPath, async function (err, files) {
                        if (err) {
                            reject('Error: unable to scan directory: ' + err);
                        } 
                       resolve(files);
                    });
                })
                let resolvedFiles = await Promise.resolve(filePromise);
                if(resolvedFiles.length == 0){
                    console.log("##### None new file found in "+directoryPath+" #####")
                } else {
                    let promiseFileList = resolvedFiles.map(async (file) => {                  
                        let completeFileName = path.join(directoryPath, file);
                        let parsedJson = Files.parseJSONtoOjectList(completeFileName);
                        network = parsedJson.network;
                        
                        let response = await executeFlashloanPromisse(network, parsedJson);
                        let serializedFile = await serializeResult(response, parsedJson, completeFileName, network);
                        console.log(serializedFile.result);
                        //remove original input file
                        if(serializedFile){
                            Files.deleteFile(completeFileName);                        
                        }
                        return serializedFile;
                    });
                    await Promise.all(promiseFileList);
                }
            } catch (error) {
                throw("Error: "+error);
            }
        
        break;
        case '9': //show main address
            Files.deleteFile(mode[1]);
        break;
        

        case '10': //show main address
            console.log("flashloanAddress: "+flashloanAddress);
            console.log("DAItokenAddress: "+DAItokenAddress);
            console.log("Host: "+truffleConfig.networks[network].host);   

        break;
        case '11': //lending pool calls
            let lendingPoolAbi = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"EthereumAddressUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"FeeProviderUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolConfiguratorUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolCoreUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolDataProviderUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolLiquidationManagerUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolManagerUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolParametersProviderUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingRateOracleUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"PriceOracleUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"ProxyCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"TokenDistributorUpdated","type":"event"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"_key","type":"bytes32"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getFeeProvider","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPool","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolConfigurator","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolCore","outputs":[{"internalType":"address payable","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolDataProvider","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolLiquidationManager","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolManager","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolParametersProvider","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingRateOracle","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getPriceOracle","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getTokenDistributor","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"isOwner","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_feeProvider","type":"address"}],"name":"setFeeProviderImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_configurator","type":"address"}],"name":"setLendingPoolConfiguratorImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_lendingPoolCore","type":"address"}],"name":"setLendingPoolCoreImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_provider","type":"address"}],"name":"setLendingPoolDataProviderImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_pool","type":"address"}],"name":"setLendingPoolImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_manager","type":"address"}],"name":"setLendingPoolLiquidationManager","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_lendingPoolManager","type":"address"}],"name":"setLendingPoolManager","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_parametersProvider","type":"address"}],"name":"setLendingPoolParametersProviderImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_lendingRateOracle","type":"address"}],"name":"setLendingRateOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_priceOracle","type":"address"}],"name":"setPriceOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_tokenDistributor","type":"address"}],"name":"setTokenDistributor","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}];
            let lendingPoolContract = new Web3js.eth.Contract(lendingPoolAbi, truffleconfig.networks[network].lendingPoolAddressesProviderAddress, { from: config.DEV_ADDRESS })
            let lendingPoolAddress = await lendingPoolContract.methods.getLendingPool().call();
            console.log("lendingPoolAddress: "+lendingPoolAddress);

            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: config.DEV_ADDRESS });
            let DAIbalanceLendigPool = await DAIcontract.methods.balanceOf(lendingPoolAddress).call();
            console.log("DAI Balance: "+parseFloat(Web3.utils.fromWei(DAIbalanceLendigPool)).toFixed(2));
            
        break;
        case '14': //withdraw from flashloan contract to dev account
            console.log("### withdraw from flashloan contract to dev account ###"); 
            let flashloanContract3 = new Web3js.eth.Contract(Flashloan.abi, flashloanAddress, { from: config.DEV_ADDRESS })
            let FlashloanRaw = {
                from: config.DEV_ADDRESS,
                chainId:network_id,
                gasLimit: 12000000,
                gasPrice: 0
            };
            let receiptWithdraw = await flashloanContract3.methods.withdraw(DAItokenAddress).send(FlashloanRaw);
            console.log(receiptWithdraw);
            exit();
        break;
        case '15': //print last block
            let block2 = await Web3js.eth.getBlock("latest");
            console.log(block2.number);
        break;
        case '16': 
            console.log("hello arbitrageur!");
        break;

        default:
            try{
                
                console.log("1"+process.env.TOKEN_ENV+"2")
            } catch (erro) {
                console.log(erro);
            } 
        break;  
        
    }
    console.timeEnd('Total Execution Time');
    console.log("######################### END FLASHLOAN EXECUTION #########################");
    exit();
    
})();