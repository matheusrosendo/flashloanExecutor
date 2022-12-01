# Flashloaner
![Licence](https://img.shields.io/github/license/matheusrosendo/TokenizationLabFixedSupply)
:warning: **Disclaimer**: That project is for educational purposes, use at your own risk

> A Solidity / Javascript (node.js) based project aimed to execute flashloans on Polygon or Ethereum. It reads an input data file and execute a flashloan (from AAVE or DODO) making swaps on UniswapV2, Curve, UniswapV2 exchanges and/or its offspring (like quickswap, sushiswap, etc).

## Important files
```
- BlockchainConfig.js: it has all the information about the blockchain you are deploying to: main token list, DEX ABI and addresses, networkID, gas info and so on
- truffle-config.js: truffle configuration file, in this project it reads information like RPC provider from BlockchainConfig.js, for more info about truffle, visit https://trufflesuite.com/docs/truffle/quickstart/ 
- Flashloaner.js Node js main file with diferent modes to comunicate with blockchain, including swap of tokens, balance and address checking, and the main part of the project (mode 5), which consists in parsing the input flashloan file and calling the deployed smart contract to execute it
- Flashloaner.sol: the smart contract itself containing all logic to execute the flashloan on both blockchains, Polygon or Ethereum. By default it takes loan from a DODO pool, because there is no fees charged, but it also works taking loan from AAVE pools. It process all swaps contained in the input parameter read from the flashloan input json file. By the end of execution, profit is sent back to contract owner (creator of the contract and sender of the transaction)
- contracts folder: all files in this folder are used by Flashloaner.sol, some interfaces were created, other were taken straight from oficial github repos of the Defis used here (UniswapV2, Dodo, UniswapV3, Curve, Aave), just like openzeppelin libraries. Some files neeeded a few adjustments in order to all complain the same solidity version, in this case 0.8.
- FlashloanInputFileExample.json: it must contain an object called *initialTokenDecimals*,  *initialTokenAmount*, *flashloanInputData* with the following data:
  - flashLoanSource: name of the source (Dodo or Aave)
  - flashLoanPool: address of the pool to take loan from
  - swaps: list of swaps to be performed by the Flashloaner smart contract, each of them must contain:
    - protocolTypeIndex: index of the protocol type (the exchange itself or the one it was forked from): CURVE_V1: 1, UNISWAP_V2: 2, UNISWAP_V3: 3 For example: Sushiswap and Quickswap are forks of the UniswapV2, so they have protocolTypeIndex = 2
    - routerAddress: address of the DEX router
    - tokenInAddress: address of token to be exchanged from
    - tokenOutAddress: address of token to be exchanged to
    - fee: necessary for UniswapV3 only
```
 
## Prerequisites
* Clone this repository: `git clone --branch https://github.com/matheusrosendo/flashloanExecutor.git`
* Enter flashloanExecutor folder and install dependencies: `npm install`
* Rename exampleDotEnv to .env
> Make sure .env is in your .gitignore file and will not be acessed by anyone else if it will contain PK and/or mnemonic of real account with valueable assets
* Copy your mnemonic, address, PK and paste it into the .env file
> If you are going to deploy on mainnets you need to set RPC_PROVIDERS (steps below). In this case it is advised to also create a brand new account to be used only for that purpose, you can use metamask.io for that
* * Fill POLYGON_RPC_PROVIDER_1 with your Polygon RPC provider. https://www.quicknode.com provides frontrunning protection, so it is a good option for that, you can also use a public one like https://polygon-rpc.com
* * Fill also ETHEREUM_RPC_PROVIDER_1 if you are going to deploy on ethereum mainnet. Some free options are: quicknode, alchemy, infura, getblock


## How to execute a known profitable route in a local forked Ethereum network on a specific block
> Here the idea is to execute a known profitable route found by my arbitrageur bot (not covered here) in a specific block (15951506) of ethereum mainnet.
* Make a local Ethereum fork replacing YOUR_RPC_PROVIDER and YOUR_MNEMONIC: `ganache-cli --fork YOUR_RPC_PROVIDER@15951506 -p 8501 --db Networks\ExampleEthereumBlock\database -m YOUR_MNEMONIC`
* Open a new terminal and deploy Flashloaner smart contract on local fork blockchain just created: `truffle migrate --reset --network ExampleEthereumBlock`
* Execute the route contained in the flashloan json file (flashloanInputFileEthereumBlock.json): `node .\Flashloaner.js 5 ExampleEthereumBlock Networks\ExampleEthereumBlock\FlashloanInput`
* Check out your owner account balances: `node .\Flashloaner.js 4 ExamplePolygonBlock`
* If it worked Ok you should be able to see 1405 USDC in your account as result of this execution. 
> Which means that if it was executed realtime on Ethereum mainnet when block 15951506 was the current block, a profit of 1405 USDC would probably be the final result
 

## How to test the Flashloaner smart contract on a local forked Polygon simulating a profitable route
> Creating a mirror of the current state of the mainnet blockchain, Polygon in this case, and artificially generate an arbitrage oportunity trading a considerable amount of the token in (WMATIC) to token out (WBTC) using a pair pool of a UniswapV2 type DEX, in this case we are going to use Quickswap and the pool WMATIC / WBTC.  This pool pair, specifically at the block to be forked here (36066000), had about only 11k USD tvl (total value locked) with approximatelly 7k WMATIC and 0.36 BTC. So the idea is to exchange 1k WMATIC to WBTC generating an artificial local arbitrage oportunity when "passing through" this pair, then executing the deployed Flashloaner contract locally checking out the results before and after that.
* make a local Polygon fork exchanging YOUR_MNEMONIC by yours: `ganache-cli --fork https://polygon-rpc.com@36066000 -p 8502 --db Networks\ExamplePolygonBlock\database -a 1 -e 1000000 -m 'YOUR_MNEMONIC'`
> Now you should have enough MATIC (1M) in your local owner account to start the process.  
* Open a new terminal and deploy Flashloaner smart contract on local fork blockchain just created: `truffle migrate --reset --network ExamplePolygonBlock`
* Try to execute the route contained in the flashloan json file : `node .\Flashloaner.js 5 ExamplePolygonBlock Networks\ExamplePolygonBlock\FlashloanInput`
> The expected result here is *FLASHLOAN ABORTED: verified amount out TOKEN inferior to initial amount*
* Check out your owner account balances: `node .\Flashloaner.js 4 ExamplePolygonBlock`
* Exchange MATIC by WMATIC, them WMATIC by WBTC: `node .\Flashloaner.js 6 ExamplePolygonBlock`
* Check again owner balances, you should have some WBTC now: `node .\Flashloaner.js 4 ExamplePolygonBlock`
* Execute again Flashloaner: `node .\Flashloaner.js 5 ExamplePolygonBlock Networks\ExamplePolygonBlock\FlashloanInput`
> if everything worked fine the expected result will be a flashloan execution with profit and a log file created on FlashloanOutput with the result
* Check owner balances one more time, now you should have the profit of this execution in USDC: `node .\Flashloaner.js 4 ExamplePolygonBlock`


## How to deploy the Flashloaner smart contract on Polygon Mainnet
> The flashloan execution itself will only conclude if a profitable route is passed as parameter, otherwise it will revert transaction. So, in order to deploy and test the interaction with the Flahsloaner smart contract, the following steps will guide you to send to it a few cents of USDC and withdraw it later. 
* Send a few MATIC to your address to pay for fees (1 MATIC is enough)
* Send a few USDC to your address (1 USDC is enough)
* Check current average gwei price for trasnsaction https://polygonscan.com/chart/gasprice and set variable `gasPricePolygon` in truffle-config.js
* Deploy contract: `truffle migrate --reset --network ExamplePolygonMainnet` (it may take some time, 5 minutes or more)
> if you receive a message like `Transaction was not mined within 750 seconds`, wait some minutes, copy hash transaction and check it out on https://polygonscan.com
* Copy the deployed contract address and paste it in the .env file (POLYGON_FLASHLOANER_ADDRESS). You can also check it out on https://polygonscan.com making a search for this address there 
* Send 50 cents to contract executing mode 7: `node .\Flashloaner.js 7 ExamplePolygonMainnet` 
* Verify if transaction happened successfully and check your account and contract balances on https://polygonscan.com
* Withdraw sent amount in USDC executing mode 8: `node .\Flashloaner.js 8 ExamplePolygonMainnet`
* Check it out the balances again. If the amount is back in your account with no failed transactions, flashloaner is set and should be ready to execute any routes with an amount out superior to the amount in
* You can try to execute the example file straight on mode 5 by the following command: `node .\Flashloaner.js 5 ExamplePolygonMainnet ExamplePolygonMainnet\FlashloanInput` 
> warning: since it will only execute profitable routes, the expected result will be a message like this: *FLASHLOAN ABORTED: verified amount out TOKEN inferior to initial amount*
* Now you can start the chalenging part: building a bot to find those profitable precious routes in real time and write a json file with the input flashloan data to be executed right after by Mode 5 :+1:
