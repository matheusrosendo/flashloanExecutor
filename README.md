# Flashloaner
![Licence](https://img.shields.io/github/license/matheusrosendo/TokenizationLabFixedSupply)
> :warning: **Disclaimer**: That project is for educational purposes, use at your own risk
> A Solidity / Javascript (node.js) based project aimed to read a json file containing flashloan input data and to execute flashloan taking loans from AAVE or DODO on Polygon or Ethereum and making swaps on UniswapV2, Curve, UniswapV2 exchanges or its offspring (Quick, Sushi, etc) etc

## Important files
```
- BlockchainConfig.js: it has all the information about the blockchain you are are deploying to: main token list, ABI and addresses of the DEX, networkID, gas info and so on
- truffle-config.js: configuration file of Truffle, in this project it reads info like RPC provider from BlockchainConfig.js, for more info about truffle, visit https://trufflesuite.com/docs/truffle/quickstart/ 
- Flashloaner.js Node js main file with diferent modes to comunicate with blockchain, including, swap tokens, checkbalances and the main part of the project (mode 5), that is parsing the input flashloan file and calling the smart contract to execute it
- Flashloaner.sol: the smart contract containing all logic to execute the flashloan on both blockchains, Polygon or Ethereum. By default it takes loan from a DODO pool, because there is no fees charged, but it also works taking loan from AAVE pools. It process all swaps contained in the input parameter read from the flashloan input json file.
- contracts files: all files in this folder is used by Flashloaner.sol, some interfaces were created, other get straight from oficial github repos of the Defis used here (UniswapV2, Dodo, UniswapV3, Curve, Aave), just like openzeppelin libraries. Some files neeeded a few adjustments in order to all complain the solidity 0.8 version.
- FlashloanInputFileExample.json: it must contain an object called *initialTokenDecimals*,  *initialTokenAmount*, *flashloanInputData* with the following data:
  - flashLoanSource: Name of the source (Dodo or Aave)
  - flashLoanPool: Address of the pool to take the loan from
  - swaps: list of the swaps to be performed by the Flashloaner smart contract, each of them must contain:
    - protocolTypeIndex: index of the protocol type (the exchange itself or the one it was forked from): CURVE_V1: 1, UNISWAP_V2: 2, UNISWAP_V3: 3 For example: Sushiswap and Quickswap are forks of the UniswapV2, so they have protocolTypeIndex = 2
    - routerAddress: address of the DEX router
    - tokenInAddress: address of token to be exchanged from
    - tokenOutAddress: address of token to be exchanged to
    - fee: necessary for UniswapV3 only
```
 
## Prerequisites
* Clone this repository: `git clone --branch LATEST-TAG https://github.com/matheusrosendo/flashloanExecutor.git`
* Rename exampleDotEnv to .env
* Make sure .env is in your .gitignore file and will not be acessed by anyone else if it will contain PK and/or mnemonic of real account with valueable assets
* Enter main folder and install dependencies: `npm install`
* Copy your mnemonic, address, PK and paste it into the .env file
> If you are going to deploy on mainnets you need to set RPC_PROVIDERS (steps below). In this case it is advised to create a brand new account, you can use metamask.io for that
* * Fill POLYGON_RPC_PROVIDER_1 with your Polygon RPC provider. https://www.quicknode.com provides frontrunning protection, so it is a good option for that, you can also use a public one like https://polygon-rpc.com
* * Fill also ETHEREUM_RPC_PROVIDER_1 if you are going to deploy on a ethereum local fork or on ethereum mainnet. Some free options are: quicknode, alchemy, infura, getblock


## How to execute a known profitable route in a forked local Ethereum on a specific block
> Here the idea is to execute a known profitable route found by my arbitrageur bot in a specific block (15951506) of ethereum mainnet.
* Make a local Ethereum fork: `ganache-cli --fork https://polygon-rpc.com@36066000 -p 8001 --db Networks\ExampleEthereumBlock\db
to be continued ...


## How to test the Flashloaner smart contract on forked local Polygon simulating a profitable route
> Create a mirror of the current state of the mainnet blockchain, Polygon in this case, and artificially generate an arbitrage oportunity trading a considerable amount of the token in (WMATIC) to token out (WBTC) using a pair pool of a UniswapV2 type DEX, in this case we are going to use Quickswap and the pool WMATIC / WBTC. Specifically at the block to be forked here (36066000), this pool pair had about only 11k USD tvl (total value locked) with approximatelly 7k WMATIC and 0.36 BTC. So the idea is to exchange 1k WMATIC to WBTC generating an artificial local arbitrage oportunity passing through this pair, then execute the deployed Flashloaner contract locally checking out the results before and after that.
* make a local Polygon fork exchanging YOUR_MNEMONIC by yours: `ganache-cli --fork https://polygon-rpc.com@36066000 -p 8502 --db Networks\ExamplePolygonBlock\database -a 1 -e 1000000 -m 'YOUR_MNEMONIC'`
> Here you are going to have enough MATIC (1M) in your local owner account to start the process 
* You should be able to see it by checkingout your owner account balances: `node .\Flashloaner.js 4 ExamplePolygonBlock`
* Deploy Flashloaner smart contract on local fork blockchain just created: `truffle migrate --reset --network ExamplePolygonBlock`
* Try to execute the route contained in the flashloan json file : `node .\Flashloaner.js 5 ExamplePolygonBlock Networks\ExamplePolygonBlock\FlashloanInput`
> the expected result here is *FLASHLOAN ABORTED: verified amount out TOKEN inferior to initial amount*
* Exchange MATIC by WMATIC, them WMATIC by WBTC: `node  .\Flashloaner.js 18 ExamplePolygonBlock`
* Check again owner balances, you should have some WBTC now: `node .\Flashloaner.js 4 ExamplePolygonBlock`
* Execute again Flashloaner: `node .\Flashloaner.js 5 ExamplePolygonBlock ExamplePolygonBlock\FlashloanInput`
> if everything worked fine the expected result will be a flashloan execute with profit and a log file created on FlashloanOutput with the result
* Check owner balances one more time, now you should have the profit of the execution in USDC: `node .\Flashloaner.js 4 ExamplePolygonBlock`


## How to deploy the Flashloaner smart contract on Polygon Mainnet
> in order to test the interaction with the deployed smart contract, the following steps will guide you to send to it a few cents of USDC and withdraw it later
* Send a few MATIC to your address to pay for fees (1 MATIC is enough)
* In order to test the contract send a few USDC to your address (1 USDC is enough)
* Deploy contract: `truffle migrate --reset --network PolygonMainnet1` (it may take some time, 5 minutes or more)
* Copy the deployd contract address and paste it in the .env file (POLYGON_FLASHLOANER_ADDRESS). You can also check it out on https://polygonscan.com
* Send 50 cents to contract executing mode 7: `node .\Flashloaner.js 7 PolygonMainnet1` 
* Verify if transaction happened successfully and check your account and contract balances on https://polygonscan.com
* Withdraw sent amount in USDC executing mode 8: `node .\Flashloaner.js 8 PolygonMainnet1`
* Check it out the balances again. If the amount is back in your account with no failed transactions, flashloaner is set and should be ready to execute any routes with an amount out superior to the amount in
* You can try to execute the example file straight on mode 5 by the following command: `node .\Flashloaner.js 5 PolygonMainnet1 PolygonMainnet1\FlashloanInput` 
> warning: since it will only execute profitable routes, the expected result will be a message like this: *FLASHLOAN ABORTED: verified amount out TOKEN inferior to initial amount*
* Now you can start the chalenging part: building a bot to find those profitable precious routes in real time and write a json with the input flashloan data to be executed by Mode 5 :+1: