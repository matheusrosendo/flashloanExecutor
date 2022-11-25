# Flashloaner

## How to create a new network

1. Flashloaner: Edit Arbitrageur/BlockchainConfig.js
2. Flashloaner: Copy paste <file>.bat (if necessary)
4. Flashloaner: Edit Flashloaner/truffle-config.js
5. Flashloaner: execute .\<new file>.bat seconds

How to deploy on polygon mainnet
It is advised to create a new address for that, using metamask for example
copy mnemonic, address and PK created and paste in .env file
fill POLYGON_RPC_PROVIDER_1 with the RPC provider. quicknode provides frontrunning protection, so it is a good option for that
send some MATIC to this address
send a few USDC to this address
deploy contracts: truffle migrate --reset --network PolygonMainnet1

