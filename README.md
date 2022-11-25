# Flashloaner

## How to deploy on Polygon Mainnet
It is advised to create a new address for that, using metamask for example
copy mnemonic, address and PK created and paste in .env file
fill POLYGON_RPC_PROVIDER_1 with the RPC provider. quicknode provides frontrunning protection, so it is a good option for that
send some MATIC to this address
send a few USDC to this address
deploy contracts: truffle migrate --reset --network PolygonMainnet1


## How to test it in a forked local Polygon simulating a profitable route
#make a fork
ganache-cli --fork https://polygon-rpc.com -p 8201 --db Networks\PolygonForkUpdate1\db -m YOUR_MNEMONIC -a 2 -e 100000000

#deploy contract
truffle migrate 
--reset --network PolygonForkUpdalashLote1

#try to execute flashloan (expected result is "FLASHLOAN ABORTED: verified amount out TOKEN inferior to initial amount")
node  .\Flashloaner.js 5 PolygonForkUpdate1 Networks\PolygonForkUpdate1\FlashloanInput 

#execute swap WMATIC by BTC using UniswapV3
node  .\Flashloaner.js 17 PolygonForkUpdate1

#try to ex
Networks\PolygonForkUpdate1\FlashloanInput

Readme FORK ethereum Spec Block

readme deploy on polygon

## How to execute a known profitable route in a forked local Ethereum on a specific block
#make a fork
#deploy contract
