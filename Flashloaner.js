const fs = require("fs");
const path = require("path");
const Web3 = require('web3');
const Flashloan = require("./build/contracts/FlashloanExecutor");
const SwapCurveV1 = require("./build/contracts/SwapCurveV1");
const truffleConfig = require("./truffle-config.js");
const Files = require("./Files.js");
const Util = require("./Util.js");
require("dotenv").config({path: ".env"});

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

async function getCurrentBlock(_network){
    let blockNumber;
    try {
        block = await getWeb3Instance(_network).eth.getBlock("latest");
        blockNumber = block.number;
    } catch (error) {
        throw("Error trying to get block, verify connection with "+"http://"+truffleConfig.networks[_network].host+":"+truffleConfig.networks[_network].port);
    }
    return blockNumber;
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
            profit: Util.amountFromBlockchain(parseInt(_response.events.LoggerBalance.returnValues.newBalance) - parseInt(_response.events.LoggerBalance.returnValues.oldBalance), _parsedJson.initialTokenDecimals, Web3)
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



function executeFlashloanPromisse (network, parsedJson){
    console.log("### Executing flashloan on "+network+" of $"+parsedJson.initialAmountInUSD+" to path "+parsedJson.path+" ###"); 
    try {
    
        let Web3js = getWeb3Instance(network);
        
        let amountToBorrowOfFirstToken = Util.amountToBlockchain(parsedJson.initialTokenAmount, parsedJson.initialTokenDecimals, Web3);
        let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, Flashloan.networks[truffleConfig.networks[network].network_id].address, { from: truffleConfig.networks[network].EXECUTOR_ADDRESS})
        let FlashloanRawTx = {
            from: truffleConfig.networks[network].EXECUTOR_ADDRESS,
            chainId:truffleConfig.networks[network].network_id,
            gasLimit: 12000000,
            gasPrice: 0
        };
        return flashloanContract.methods.flashloanAAVEv1(amountToBorrowOfFirstToken, parsedJson.addressPath).send(FlashloanRawTx); 
        
    } catch (error) {
        throw new Error(error)  
    }                    
}

function withdrawToken (_network, _tokenAddress){
    console.log("### Withdrawing profits in DAI ###"); 
    let Web3js = getWeb3Instance(_network);
    
    let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, Flashloan.networks[truffleConfig.networks[_network].network_id].address, { from: truffleConfig.networks[_network].EXECUTOR_ADDRESS })
    let FlashloanRawTx = {
        from: truffleConfig.networks[_network].EXECUTOR_ADDRESS,
        chainId:truffleConfig.networks[_network].network_id,
        gasLimit: 12000000,
        gasPrice: 0
    };
    return flashloanContract.methods.withdraw(_tokenAddress).send(FlashloanRawTx);                     
}

function withdrawTokenSigned (_network, _tokenAddress){
    console.log("### Withdrawing profits in DAI ###"); 
    let Web3js = getWeb3Instance(_network);
    
    let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, Flashloan.networks[truffleConfig.networks[_network].network_id].address, { from: truffleConfig.networks[_network].EXECUTOR_ADDRESS })
        
    
    let FlashloanRawTx = {
        from: truffleConfig.networks[_network].EXECUTOR_ADDRESS,
        chainId:truffleConfig.networks[_network].network_id,
        gasLimit: 12000000,
        gasPrice: 0
    };

    //sign tx
    let signedTxPromise = Web3js.eth.signTransaction(FlashloanRawTx, truffleConfig.networks[_network].DEV_PK);
                
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
        let owner = await flashloanContract.methods.owner().call(); Flashloan
        if (owner == _OwnerAddress){
            return true;
        } else {
            console.log("Error: contract found but owner is not the informed address, owner found = "+owner);
            return false;
        }        
    } catch (error) {
        return false;
    }
}

async function getOwner(_network, _contract){
    try {
        let Web3js = getWeb3Instance(_network);
        let flashloanContract = new Web3js.eth.Contract(_contract.abi, _contract.networks[truffleConfig.networks[_network].network_id].address)
        let owner = await flashloanContract.methods.owner().call(); 
        return owner;
    } catch (error) {
        console.log("Error: "+error);
    }
}

(async () => {
    console.time('Total Execution Time');    
    console.log("######################### START FLASHLOAN EXECUTION #########################");

    //read and verify arguments
    let mode = process.argv.filter((item, index) =>{return index >= 2})
    if(mode.length < 2){
        console.log("Error invalid call, less than 2 parameters. Ex: Node .\\Flashloaner.js 5 ethereum_fork_update ");
        exit();
    }

    //set network and some variables used to transfer initial amounts to contract and dev account (local forks only)
    let network = mode[1];
    if(truffleConfig.networks[network] == undefined){
        throw("Error: invalid network name = "+network);
    }
    console.log("### network: "+network+" ###"); 
    let Web3js = getWeb3Instance(network);   
    let currentBlock = await getCurrentBlock(network);
    let DAIcontract;  
    let DAIcontractABI = truffleConfig.networks[network].DAIabi;
    let network_id = truffleConfig.networks[network].network_id;
    let DAItokenAddress = truffleConfig.networks[network].DAIcontract;   
    let flashloanAddress = Flashloan.networks[network_id].address; 
    let executorAddress = truffleConfig.networks[network].EXECUTOR_ADDRESS;
    
    let SwapCurveV1Address = SwapCurveV1.networks[network_id].address

    let truffleAddressAccount = "0xAC3bAE300eBA121510A444ab378EC7D065789F49";

    switch(mode[0]){
        case '1': //get some ETH from a rich account and send to dev and flashloan contract  (development mode only)
        console.log("######### Mode 1 | GET DAI and ETH #########");
            //send ETH from rich account to my dev account
            await Web3js.eth.sendTransaction({
                from: truffleConfig.networks[network].RICH_ADDRESS, 
                to: executorAddress, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })

            //send ETH to truffle account
            await Web3js.eth.sendTransaction({
                from: truffleConfig.networks[network].RICH_ADDRESS, 
                to: truffleAddressAccount, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })

            
             //send ETH to swapcurve contract
             await Web3js.eth.sendTransaction({
                from: truffleConfig.networks[network].RICH_ADDRESS, 
                to: SwapCurveV1Address, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })


            //send ETH from rich account to smart contract
            await Web3js.eth.sendTransaction({
                from: truffleConfig.networks[network].RICH_ADDRESS, 
                to: flashloanAddress, 
                value: Web3.utils.toWei(process.env.ETH_AMOUNT_INITIAL_FUND_ON_FORK)
            })
            
            //send DAI from rich account to my dev account
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: truffleConfig.networks[network].RICH_ADDRESS })
            var rawTransaction = {
                from: truffleConfig.networks[network].RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(executorAddress, Web3.utils.toWei(process.env.DAI_AMOUNT_INITIAL_FUND_ON_FORK)).encodeABI(),
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
                from: truffleConfig.networks[network].RICH_ADDRESS,
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
        
        case '2': //Fund Flashloan smart contract with DAI
            console.log("######### Mode 2 | FUND SC FLASHLOAN WITH DAI #########");
            //get some DAI from a rich account  (development mode only)
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: truffleConfig.networks[network].RICH_ADDRESS })
            
            //send DAI from rich account to flashloan contract
            var rawTransaction = {
                from: truffleConfig.networks[network].RICH_ADDRESS,
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
            if(isContractOk(network, executorAddress)){
                console.log("### balances of contract "+flashloanAddress+" ###");
                //check balance of DAI in the Flashloan Smartcontract
                DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: executorAddress});
                let DAIbalanceFlashloanContract = await DAIcontract.methods.balanceOf(flashloanAddress).call();
                console.log("DAIbalanceFlashloanContract (DAI)= " + Web3.utils.fromWei(DAIbalanceFlashloanContract));
                console.log("DAIbalanceFlashloanContract (Wei DAI)= " + DAIbalanceFlashloanContract);
    
                let ETHbalanceFlashloanContract = await Web3js.eth.getBalance(flashloanAddress);
                console.log("ETHbalanceFlashloanContract = " + Web3.utils.fromWei(ETHbalanceFlashloanContract));
                let ETHbalanceTreuffleAccount = await Web3js.eth.getBalance(truffleAddressAccount);
                console.log("truffleAddressAccount = " + Web3.utils.fromWei(ETHbalanceTreuffleAccount));

                let ETHbalanceSwapCurve = await Web3js.eth.getBalance(SwapCurveV1Address);
                console.log("ETHbalanceSwapCurve = " + Web3.utils.fromWei(ETHbalanceSwapCurve));

                let DAIbalanceSwapCurveV1 = await DAIcontract.methods.balanceOf(SwapCurveV1Address).call();
                console.log("DAIbalanceSwapCurveV1 = " + Web3.utils.fromWei(DAIbalanceSwapCurveV1));

                let swapCurveContract = new Web3js.eth.Contract(SwapCurveV1.abi, SwapCurveV1.networks[truffleConfig.networks[network].network_id].address, { from: truffleConfig.networks[network].EXECUTOR_ADDRESS})
                let USDCbalanceSwapCurveV1 = await swapCurveContract.methods.balanceOfToken("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48").call();
                console.log("USDCbalanceSwapCurveV1 = " + USDCbalanceSwapCurveV1 / Math.pow(10, 6));
                exit();
            }

        break;
        
        // check dev account DAI and ETH balances
        // Ex: node .\Flashloaner.js 4 ethereum_fork_update
        case '4': 
            console.log("######### Mode 4 | EXECUTOR ACCOUNT BALANCES #########");
            console.log("### balances of account "+executorAddress+" ###");   
            //check balance of DAI in the Flashloan Smartcontract
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress);
            let DAIbalanceDevAccount = await DAIcontract.methods.balanceOf(executorAddress).call();
            console.log("DAIbalanceDevAccount = " + Web3.utils.fromWei(DAIbalanceDevAccount));

            let ETHbalanceDevAccount = await Web3js.eth.getBalance(executorAddress);
            console.log("ETHbalanceDevAccount = " + Web3.utils.fromWei(ETHbalanceDevAccount));
            exit();
        break;
        
        //withdraw DAI to owner
         // Ex: node .\Flashloaner.js 5 ethereum_fork_update
        case '5': 
            try {
                //verify current DAI amount
                DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: executorAddress});
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
                console.log("Error: "+error);
            }
        break;
        case '5.1': 
            try {
                //verify current DAI amount
                DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: executorAddress});
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
                console.log("Error: "+error);
            }
        break;
        
        // print last block   
        case '6': 
            console.log(currentBlock);
        break;
        
        // execute flash loan reading from a specific file
        // ex: node .\Flashloaner.js 7 ethereum_fork_update ethereum_fork_update\FlashloanInput\2022-09-30_09-35_exec_09-36.json
        case '7': 
            try {
                if(isContractOk(network, executorAddress)){
                    
                    let fileName = mode[2];
                    let parsedJson = Files.parseJSONtoOjectList(fileName);
                    if(parsedJson == undefined){
                        throw("Error: file not found "+fileName);
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
                console.log("Error: "+error);
            }
        
        break;
       
        //search for a new file on flashloan input folder and execute it
        //ex: node .\Flashloaner.js 8 ethereum_fork_update ethereum_fork_update\FlashloanInput
        case '8': 
            console.log("######### Mode 8 | VERIFY INPUT FOLDER AND EXECUTE FLASHLOAN #########");
            try {
                if(mode.length < 3){
                    throw("Invalid number of parameters! Ex: node .\\Flashloaner.js 8 EthereumForkUpdate Networks\\EthereumForkUpdate\\FlashloanInput");
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
                        }
                    });
                    await Promise.all(promiseFileList);
                }
            } catch (error) {
                throw("Error: "+error);
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

                let swapCurveContract = new Web3js.eth.Contract(SwapCurveV1.abi, SwapCurveV1.networks[truffleConfig.networks[network].network_id].address, { from: truffleConfig.networks[network].EXECUTOR_ADDRESS})
                let SwapCurveRawTx = {
                    from: truffleConfig.networks[network].EXECUTOR_ADDRESS,
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
                throw("Error: "+error);
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

                let swapCurveContract = new Web3js.eth.Contract(SwapCurveV1.abi, SwapCurveV1.networks[truffleConfig.networks[network].network_id].address, { from: truffleConfig.networks[network].EXECUTOR_ADDRESS});
                let amountOut = await swapCurveContract.methods.amountOutOnCurveV1(amountToExchange, tokenInAddress, tokenOutAddress, poolAddress).call(); 
                console.log("###### Estimated amount out ("+tokenOutAddress+"): ######");
                console.log(amountOut / Math.pow(10, 6));
            } catch (error) {
                throw("Error: "+error);
            }
        break;

        //show main address
        case '10': 
            console.log("######### Mode 10 | SHOW MAIN ADDRESSES #########");
            let ownerFlashloan = await getOwner(network, Flashloan);
            console.log("executorAddress: "+executorAddress);
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

        case '12':
            const balance = 1000;
            const decimals = 9;
            let initialAmount = Util.amountToBlockchain(balance, decimals, Web3);
            console.log( "initialAmount to blockchain = " + initialAmount);

            console.log( "initialAmount from blockchain = " + Util.amountFromBlockchain(initialAmount, decimals, Web3));
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