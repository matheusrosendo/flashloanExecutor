// const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider")
require("dotenv").config({path: ".env"});
const {BlockchainConfig} = require("./BlockchainConfig.js");

//truffle must be called passing network name as last parameter
let mode = process.argv.filter((item, index) =>{return index >= 2})
let network = mode[mode.length-1];
if(!BlockchainConfig.network[network]){
	throw new Error("Truffle error: undefined network "+network);
}
let RPCprovider = new HDWalletProvider(process.env.OWNER_PK, BlockchainConfig.network[network].RPC_FLASHLOANER_PROVIDER);
let networkCheckTimeout = 1000000000;
let timeoutBlocks = 10000000;

module.exports = {
	// See <http://truffleframework.com/docs/advanced/configuration> to customize your Truffle configuration!
	// contracts_build_directory: path.join(__dirname, "client/src/contracts"),
	networks: {
		development: {
			host: "127.0.0.1", 
			port: 9545,
			// gas: 20000000,
			network_id: 1,
			skipDryRun: true,
		},
		PolygonFork1: {
			host: "127.0.0.1", 
			port: 8201,
			network_id: 137,
			skipDryRun: true,	
			
			blockchain: "polygon"
		},
		EthereumForkUpdate1: {
			provider: RPCprovider,
			network_id: 1,
			skipDryRun: true,
			blockchain: "ethereum",
			networkCheckTimeout: networkCheckTimeout,
			timeoutBlocks: timeoutBlocks
		},
		EthereumForkUpdate2: {
			provider: RPCprovider,
			network_id: 1,
			skipDryRun: true,
			blockchain: "ethereum",
			networkCheckTimeout: networkCheckTimeout,
			timeoutBlocks: timeoutBlocks
		},
		EthereumForkUpdate3: {
			provider: RPCprovider,
			network_id: 1,
			skipDryRun: true,
			blockchain: "ethereum",
			networkCheckTimeout: networkCheckTimeout,
			timeoutBlocks: timeoutBlocks
		},
		EthereumForkPast: {
			provider: RPCprovider,
			network_id: 1,
			skipDryRun: true,
			blockchain: "ethereum",
			networkCheckTimeout: networkCheckTimeout,
			timeoutBlocks: timeoutBlocks
		},

		EthereumForkSpecBlock: {
			provider: RPCprovider,
			network_id: 1,
			skipDryRun: true,
			blockchain: "ethereum",
			networkCheckTimeout: networkCheckTimeout,
			timeoutBlocks: timeoutBlocks
		}
	},
	compilers: {
		solc: {
			version: "^0.8.0",
		},
	},
}
