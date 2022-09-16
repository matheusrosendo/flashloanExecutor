const Web3 = require('web3')
require("dotenv").config({path: ".env"});
const truffleconfig = require("./truffle-config.js");
const Flashloan = require("./build/contracts/Flashloan.json");
let contractDai;


function exit(){
    process.exit();
}

async function sendTokenNoSign(_contractInstance, _toAddress, _fromAddress, _networkID){
    DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: process.env.RICH_ADDRESS })
    var rawTransaction = {
        from: process.env.RICH_ADDRESS,
        to: DAItokenAddress,
        value: 0,
        data: DAIcontract.methods.transfer(process.env.DEV_ADDRESS , Web3.utils.toWei(DaiAmountFromRich)).encodeABI(),
        gas: 200000,
        chainId: network_id
    };            
    await Web3js.eth.sendTransaction(rawTransaction, (error, receipt) => {
        if (error) {
            console.log('DEBUG - error in _sendToken ', error)
        }
        console.log(receipt);
    });
}

(async () => {
    const DAIcontractABI = truffleconfig.networks[process.env.NETWORK].DAIabi;
    let Web3js;
    if(process.env.NETWORK == "development"){
        Web3js = new Web3(truffleconfig.networks[process.env.NETWORK].localProvider);
    } else {
        Web3js = new Web3(truffleconfig.networks[process.env.NETWORK].provider);
    }
    const network_id = truffleconfig.networks[process.env.NETWORK].network_id;
    let DAItokenAddress = truffleconfig.networks[process.env.NETWORK].DAIcontract;   
    let flashloanAddress = Flashloan.networks[network_id].address;
    let DAIcontract;

    let mode = process.argv[process.argv.length-1];
    switch(mode){
        case '1': //Fund Flashloan smart contract
            //get some ETH from a rich account and send to dev and flashloan contract  (development mode only)
            if(process.env.NETWORK == "development"){
            
                let DaiAmountFromRich = '10';
                let EthAmountFromRich = '2';
                

                //send ETH from rich account to my dev account
                await Web3js.eth.sendTransaction({
                    from: process.env.RICH_ADDRESS, 
                    to: process.env.DEV_ADDRESS , 
                    value: Web3.utils.toWei(EthAmountFromRich)
                })

                //send ETH from rich account to smart contract
                await Web3js.eth.sendTransaction({
                    from: process.env.RICH_ADDRESS, 
                    to: flashloanAddress, 
                    value: Web3.utils.toWei(EthAmountFromRich)
                })
                
                //send DAI from rich account to my dev account
                DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: process.env.RICH_ADDRESS })
                var rawTransaction = {
                    from: process.env.RICH_ADDRESS,
                    to: DAItokenAddress,
                    value: 0,
                    data: DAIcontract.methods.transfer(process.env.DEV_ADDRESS , Web3.utils.toWei(DaiAmountFromRich)).encodeABI(),
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
                    from: process.env.RICH_ADDRESS,
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
                console.log("### ETH and DAI sent ###")
            } 
            //send some DAI and ETH from dev account to flashloan contract  (signed transactions)
            else {
                /////////////// send ETH //////////////////
                let EthAmountFromDev = '0.001';
                
                //declare raw tx
                let rawTx = {
                    from: process.env.DEV_ADDRESS, 
                    to: flashloanAddress, 
                    value: Web3.utils.toWei(EthAmountFromDev),
                    gas: 200000,
                    chainId: network_id
                };
                
                //sign tx
                let signedTxPromise = Web3js.eth.signTransaction(rawTx, process.env.DEV_PK);
                
                //handle response tx
                signedTxPromise.then((signedTx)=>{
                    let sentTx = Web3js.eth.sendSignedTransaction(signedTx.raw || signedTx.rawTransaction);
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

                
            }
        break;
        case '2': //Fund Flashloan smart contract with DAI
            //get some DAI from a rich account  (development mode only)
            if(process.env.NETWORK == "development"){
            
                let DaiAmountFromRich = '10';

                //send DAI from rich account to flashloan contract
                var rawTransaction = {
                    from: process.env.RICH_ADDRESS,
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
            } 
            //send some DAI from dev account to flashloan contract  (signed transactions)
            else {
                /////////////// send DAI //////////////////
                let DAIamountFromDev = '10';
                DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: process.env.DEV_ADDRESS })
                
                //declara raw tx
                let DAIrawTx = {
                    from: process.env.DEV_ADDRESS,
                    to: DAItokenAddress,
                    value: 0,
                    data: DAIcontract.methods.transfer(flashloanAddress, Web3.utils.toWei(DAIamountFromDev)).encodeABI(),
                    gas: 200000,
                    chainId:network_id
                };

                //sign tx
                let DAIsignedTxPromise = Web3js.eth.signTransaction(DAIrawTx, process.env.DEV_PK);
                
                //handle tx response 
                DAIsignedTxPromise.then((signedTx)=>{
                    let sentTx = Web3js.eth.sendSignedTransaction(signedTx.raw || signedTx.rawTransaction);
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
                
            }
        break;
        case '3': //check flashloan contract DAI and ETH balances
            console.log("### balances of contract "+flashloanAddress+" ###");
            //check balance of DAI in the Flashloan Smartcontract
            contractDai = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: process.env.DEV_ADDRESS });
            let DAIbalanceFlashloanContract = await contractDai.methods.balanceOf(flashloanAddress).call();
            console.log("DAIbalanceFlashloanContract (DAI)= " + Web3.utils.fromWei(DAIbalanceFlashloanContract));
            console.log("DAIbalanceFlashloanContract (Wei DAI)= " + DAIbalanceFlashloanContract);
 
            let ETHbalanceFlashloanContract = await Web3js.eth.getBalance(flashloanAddress);
            console.log("ETHbalanceFlashloanContract = " + Web3.utils.fromWei(ETHbalanceFlashloanContract));
            exit();

        break;
        case '4': //check dev account DAI and ETH balances
            console.log("### balances of account "+process.env.DEV_ADDRESS+" ###");   
            //check balance of DAI in the Flashloan Smartcontract
            contractDai = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: process.env.RICH_ADDRESS });
            let DAIbalanceDevAccount = await contractDai.methods.balanceOf(process.env.DEV_ADDRESS).call();
            console.log("DAIbalanceDevAccount = " + Web3.utils.fromWei(DAIbalanceDevAccount));

            let ETHbalanceDevAccount = await Web3js.eth.getBalance(process.env.DEV_ADDRESS);
            console.log("ETHbalanceDevAccount = " + Web3.utils.fromWei(ETHbalanceDevAccount));
            exit();
        break;
        case '5': //execute flash loan
            try {
                let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, flashloanAddress, { from: process.env.DEV_ADDRESS })
                
                //declara raw tx
                let FlashloanRawTx = {
                    from: process.env.DEV_ADDRESS,
                    data: flashloanContract.methods.flashloan(DAItokenAddress).encodeABI(),
                    gas: 1000000,
                    chainId:network_id
                };

                //sign tx
                let flashloanSignedTxPromise = Web3js.eth.signTransaction(FlashloanRawTx, process.env.DEV_PK);
                
                //handle tx response 
                flashloanSignedTxPromise.then((signedTx)=>{
                    let sentTx = Web3js.eth.sendSignedTransaction(signedTx.raw);
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
                
            } catch (error) {
                console.log("Error: "+error);
            }
            
        break;
        case '6': //print last block
            let block2 = await Web3js.eth.getBlock("latest");
            console.log(block2.number);
        break;
        case '7': //show last transaction of last block (dont work at development mode)
            let blockNumber = await Web3js.eth.getBlock("latest");
            let receipt = await Web3js.eth.getTransactionFromBlock(blockNumber.number, 0);
            console.log(receipt);
        break;
        
    }
    
    

})();