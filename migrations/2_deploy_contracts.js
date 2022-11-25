let Flashloaner = artifacts.require("Flashloaner");
const truffleConfig = require("../truffle-config.js");
const {BlockchainConfig} = require("../BlockchainConfig.js");

module.exports = async function (deployer, network) {
    try {
        if (truffleConfig.networks[network].provider || truffleConfig.networks[network].url){
            console.log(`#### Deploying contracs on ${network} running on ${BlockchainConfig.network[network].RPC_FLASHLOANER_PROVIDER} ####`);
            console.log("### curve stablecoins: ###");
            let curveStablecoins = BlockchainConfig.blockchain[BlockchainConfig.network[network].BLOCKCHAIN].CURVE_STABLECOINS_POOL3;
            console.log(curveStablecoins);
            let networkId = BlockchainConfig.blockchain[BlockchainConfig.network[network].BLOCKCHAIN].NETWORK_ID;
            console.log(`### network Id: ${networkId} ###`);
                        
            await deployer.deploy(Flashloaner, curveStablecoins, networkId);
        } else {
            throw new Error(`Error: url or provider not found on truffleconfig file for this network: ${network})`)
        }
    } catch (e) {
        throw (`Error deploying contracts: ${e.message}`)
    }
}