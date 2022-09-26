const fs = require("fs");
const Web3 = require('web3');
const config = require("./config.json");
const Flashloan = require("./build/contracts/FlashloanAAVEv1");

function exit(){
    process.exit();
}

function parseJSONtoOjectList(_file){
    let objList;
    try {
        let fileContent = fs.readFileSync(_file, 'utf8');
        objList  = JSON.parse(fileContent); 
    } catch (error) {
        console.log("Error trying to read "+_file+" | "+error);
    }    
    return objList;
}

(async () => {
    let DAIcontract;  
    const DAIcontractABI = config.DAIabi;
    let Web3js = new Web3(config.localProvider);
    const network_id = config.network_id;
    let DAItokenAddress = config.DAIcontract;   
    let flashloanAddress = Flashloan.networks[network_id].address;
    let mode = process.argv.filter((item, index) =>{return index >= 2})
    let DaiAmountFromRich = '100';
    let EthAmountFromRich = '2';
    switch(mode[0]){
        case '1': //get some ETH from a rich account and send to dev and flashloan contract  (development mode only)
         
            //send ETH from rich account to my dev account
            await Web3js.eth.sendTransaction({
                from: config.RICH_ADDRESS, 
                to: config.DEV_ADDRESS , 
                value: Web3.utils.toWei(EthAmountFromRich)
            })

            //send ETH from rich account to smart contract
            await Web3js.eth.sendTransaction({
                from: config.RICH_ADDRESS, 
                to: flashloanAddress, 
                value: Web3.utils.toWei(EthAmountFromRich)
            })
            
            //send DAI from rich account to my dev account
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: config.RICH_ADDRESS })
            var rawTransaction = {
                from: config.RICH_ADDRESS,
                to: DAItokenAddress,
                value: 0,
                data: DAIcontract.methods.transfer(config.DEV_ADDRESS , Web3.utils.toWei(DaiAmountFromRich)).encodeABI(),
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
                from: config.RICH_ADDRESS,
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
                
            
        break;
        case '2': //Fund Flashloan smart contract with DAI
            //get some DAI from a rich account  (development mode only)
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: config.RICH_ADDRESS })
            
            //send DAI from rich account to flashloan contract
            var rawTransaction = {
                from: config.RICH_ADDRESS,
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
            
        break;
        case '3': //check flashloan contract DAI and ETH balances
            console.log("### balances of contract "+flashloanAddress+" ###");
            //check balance of DAI in the Flashloan Smartcontract
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: config.DEV_ADDRESS });
            let DAIbalanceFlashloanContract = await DAIcontract.methods.balanceOf(flashloanAddress).call();
            console.log("DAIbalanceFlashloanContract (DAI)= " + Web3.utils.fromWei(DAIbalanceFlashloanContract));
            console.log("DAIbalanceFlashloanContract (Wei DAI)= " + DAIbalanceFlashloanContract);
 
            let ETHbalanceFlashloanContract = await Web3js.eth.getBalance(flashloanAddress);
            console.log("ETHbalanceFlashloanContract = " + Web3.utils.fromWei(ETHbalanceFlashloanContract));
            exit();

        break;
        case '4': //check dev account DAI and ETH balances
            console.log("### balances of account "+config.DEV_ADDRESS+" ###");   
            //check balance of DAI in the Flashloan Smartcontract
            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: config.RICH_ADDRESS });
            let DAIbalanceDevAccount = await DAIcontract.methods.balanceOf(config.DEV_ADDRESS).call();
            console.log("DAIbalanceDevAccount = " + Web3.utils.fromWei(DAIbalanceDevAccount));

            let ETHbalanceDevAccount = await Web3js.eth.getBalance(config.DEV_ADDRESS);
            console.log("ETHbalanceDevAccount = " + Web3.utils.fromWei(ETHbalanceDevAccount));
            exit();
        break;
        case '5': //execute flash loan
            try {
                console.log("### execute flashloan ###"); 
                let DAIamountInWei = Web3.utils.toWei('10');
                let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, flashloanAddress, { from: config.DEV_ADDRESS })
                let FlashloanRawTx = {
                    from: config.DEV_ADDRESS,
                    chainId:network_id,
                    gasLimit: 12000000,
                    gasPrice: 0
                };
                let response = await flashloanContract.methods.flashloan(DAItokenAddress, DAIamountInWei).send(FlashloanRawTx);        
                console.log(response);
                exit();
                
            } catch (error) {
                console.log("Error: "+error);
            }
            
        break;
        case '6': //execute flash loan uniswapv2
            try {
                console.log("### execute flashloan ###"); 
                let DAIamountInWei = Web3.utils.toWei('50');
                //DAI -> USDC (uniswap) | USDC -> USDT (Sushi) | USDT -> DAI (Uniswap)
                let addressData = ["0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", "0x6B175474E89094C44Da98b954EedeAC495271d0F", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0x6B175474E89094C44Da98b954EedeAC495271d0F"];
                let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, flashloanAddress, { from: config.DEV_ADDRESS })
                let FlashloanRawTx = {
                    from: config.DEV_ADDRESS,
                    chainId:network_id,
                    gasLimit: 12000000,
                    gasPrice: 0
                };
                let response = await flashloanContract.methods.flashloanUniswapV2(DAIamountInWei, addressData).send(FlashloanRawTx);        
                console.log(response);
                exit();
                
            } catch (error) {
                console.log("Error: "+error);
            }
            
        break;
        case '7': //execute flash loan reading from file
            try {
                let jsonFile = mode[1];
                console.log("### execute flashloan from file "+jsonFile+" ###"); 
                let parsedJson = parseJSONtoOjectList(jsonFile);
                let amountToBorrowOfFirstToken = Web3.utils.toWei(parseFloat(parsedJson.initialTokenAmount).toString());
                let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, flashloanAddress, { from: config.DEV_ADDRESS })
                let FlashloanRawTx = {
                    from: config.DEV_ADDRESS,
                    chainId:network_id,
                    gasLimit: 12000000,
                    gasPrice: 0
                };
                let response = await flashloanContract.methods.flashloanUniswapV2(amountToBorrowOfFirstToken, parsedJson.addressPath).send(FlashloanRawTx);        
                console.log(response);
                exit();
                
            } catch (error) {
                console.log("Error: "+error);
            }
            
        break;
        

        case '10': //show main address
            console.log("flashloanAddress: "+flashloanAddress);
            console.log("DAItokenAddress: "+DAItokenAddress);
            console.log("lendingPoolAddressesProviderAddress: "+truffleconfig.networks[config.NETWORK].lendingPoolAddressesProviderAddress);   
            exit();
        break;
        case '11': //lending pool calls
            let lendingPoolAbi = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"EthereumAddressUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"FeeProviderUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolConfiguratorUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolCoreUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolDataProviderUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolLiquidationManagerUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolManagerUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolParametersProviderUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingPoolUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"LendingRateOracleUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"PriceOracleUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"ProxyCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAddress","type":"address"}],"name":"TokenDistributorUpdated","type":"event"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"_key","type":"bytes32"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getFeeProvider","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPool","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolConfigurator","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolCore","outputs":[{"internalType":"address payable","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolDataProvider","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolLiquidationManager","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolManager","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingPoolParametersProvider","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendingRateOracle","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getPriceOracle","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getTokenDistributor","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"isOwner","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_feeProvider","type":"address"}],"name":"setFeeProviderImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_configurator","type":"address"}],"name":"setLendingPoolConfiguratorImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_lendingPoolCore","type":"address"}],"name":"setLendingPoolCoreImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_provider","type":"address"}],"name":"setLendingPoolDataProviderImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_pool","type":"address"}],"name":"setLendingPoolImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_manager","type":"address"}],"name":"setLendingPoolLiquidationManager","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_lendingPoolManager","type":"address"}],"name":"setLendingPoolManager","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_parametersProvider","type":"address"}],"name":"setLendingPoolParametersProviderImpl","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_lendingRateOracle","type":"address"}],"name":"setLendingRateOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_priceOracle","type":"address"}],"name":"setPriceOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_tokenDistributor","type":"address"}],"name":"setTokenDistributor","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}];
            let lendingPoolContract = new Web3js.eth.Contract(lendingPoolAbi, truffleconfig.networks[config.NETWORK].lendingPoolAddressesProviderAddress, { from: config.DEV_ADDRESS })
            let lendingPoolAddress = await lendingPoolContract.methods.getLendingPool().call();
            console.log("lendingPoolAddress: "+lendingPoolAddress);

            DAIcontract = await new Web3js.eth.Contract(DAIcontractABI, DAItokenAddress, { from: config.DEV_ADDRESS });
            let DAIbalanceLendigPool = await DAIcontract.methods.balanceOf(lendingPoolAddress).call();
            console.log("DAI Balance: "+parseFloat(Web3.utils.fromWei(DAIbalanceLendigPool)).toFixed(2));
            exit();
        break;
        case '12': //increment counter test variable
            console.log("### incrementing uint account value ###"); 
            let flashloanContract = new Web3js.eth.Contract(Flashloan.abi, flashloanAddress, { from: config.DEV_ADDRESS })
            let FlashloanRawTx = {
                from: config.DEV_ADDRESS,
                chainId:network_id,
                gasLimit: 12000000,
                gasPrice: 0
            };
            let response = await flashloanContract.methods.incrementer(2).send(FlashloanRawTx);        
            console.log(response);
            exit();
        break;
        case '13': //show counter test variable
            console.log("### uint account value: ###"); 
            let flashloanContract2 = new Web3js.eth.Contract(Flashloan.abi, flashloanAddress, { from: config.DEV_ADDRESS })
            let amount = await flashloanContract2.methods.getCounter().call();
            console.log(amount);
            exit();
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
        case '16': //print last block
            console.log("testing call node.js other directory");
        break;

        
    }
    
    

})();