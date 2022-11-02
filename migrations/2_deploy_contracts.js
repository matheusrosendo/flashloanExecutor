let AddressCoderLib = artifacts.require("AddressCoder");
let FlashloanNewInput = artifacts.require("FlashloanNewInput");
let Flashloaner = artifacts.require("Flashloaner");
const truffleConfig = require("../truffle-config.js");
const {blockchainConfig} = require("../BlockchainConfig.js");

module.exports = async function (deployer, network) {
    try {
        if (truffleConfig.networks[network].provider || truffleConfig.networks[network].url){
            console.log(`#### Deploying contracs on ${network} running on ${blockchainConfig.network[network].RPC_PROVIDER_URL} ####`);
            await deployer.deploy(AddressCoderLib);
            await deployer.link(AddressCoderLib, FlashloanNewInput);
            await deployer.link(AddressCoderLib, Flashloaner);
            await deployer.deploy(FlashloanNewInput);
            await deployer.deploy(Flashloaner);
        } else {
            throw new Error(`Error: url or provider not found on truffleconfig file for this network: ${network})`)
        }
    } catch (e) {
        throw (`Error deploying contracts: ${e.message}`)
    }
}