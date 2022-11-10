let AddressCoderLib = artifacts.require("AddressCoder");
let Flashloaner = artifacts.require("Flashloaner");
const truffleConfig = require("../truffle-config.js");
const {BlockchainConfig} = require("../BlockchainConfig.js");

module.exports = async function (deployer, network) {
    try {
        if (truffleConfig.networks[network].provider || truffleConfig.networks[network].url){
            console.log(`#### Deploying contracs on ${network} running on ${BlockchainConfig.network[network].BLOCKCHAIN_RPC_FLASHLOANER_PROVIDER} ####`);
            await deployer.deploy(AddressCoderLib);
            await deployer.link(AddressCoderLib, Flashloaner);
            await deployer.deploy(Flashloaner);
        } else {
            throw new Error(`Error: url or provider not found on truffleconfig file for this network: ${network})`)
        }
    } catch (e) {
        throw (`Error deploying contracts: ${e.message}`)
    }
}