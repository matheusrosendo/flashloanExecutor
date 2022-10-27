// const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider")
require("dotenv").config({path: ".env"});
const {blockchainConfig} = require("./BlockchainConfig.js");


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
	    host: "127.0.0.1", 
		port: 8001,
	    network_id: 1,
	    skipDryRun: true,
		
		blockchain: "ethereum"
	 },
	 EthereumForkUpdate2: {
	    host: "127.0.0.1", 
		port: 8002,
	    network_id: 1,
	    skipDryRun: true,		

		blockchain: "ethereum"
	 },
	 EthereumForkUpdate3: {
	    host: "127.0.0.1", 
		port: 8003,
	    network_id: 1,
	    skipDryRun: true,		

		blockchain: "ethereum"
	 },
	 EthereumForkUpdate4: {
	    host: "127.0.0.1", 
		port: 8004,
	    network_id: 1,
	    skipDryRun: true,		

		blockchain: "ethereum"
	 },
	 EthereumForkUpdate5: {
		url: blockchainConfig.network["EthereumForkUpdate5"].RPC_PROVIDER_URL,
	    network_id: 1,
	    skipDryRun: true,
		blockchain: "ethereum"
	 },
	 EthereumForkPast: {
	    host: "127.0.0.1", 
		port: 8100,
	    network_id: 1,
	    skipDryRun: true,		

		blockchain: "ethereum"
	 },

	 EthereumForkSpecBlock: {
		provider: new HDWalletProvider(process.env.OWNER_PK, blockchainConfig.network["EthereumForkSpecBlock"].RPC_PROVIDER_URL),
	    network_id: 1,
	    skipDryRun: true,
		blockchain: "ethereum",
		networkCheckTimeout: 10000000,
		timeoutBlocks: 10000000
	 },
	  goerli: {
	    provider: new HDWalletProvider(process.env.OWNER_PK, "https://goerli.infura.io/v3/" + process.env.INFURA_API_KEY),
	    network_id: 3,
	    gas: 5000000,
		gasPrice: 5000000000, // 5 Gwei
		skipDryRun: true,
	  },
	  mainnet: {
	    provider: new HDWalletProvider(process.env.OWNER_PK, "https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
	    network_id: 1,
	    gas: 5000000,
	    gasPrice: 5000000000, // 5 Gwei
	  }
	},
	compilers: {
		solc: {
			version: "^0.8.0",
		},
	},
}
