let AddressCoderLib = artifacts.require("AddressCoder");
let FlashloanExecutor = artifacts.require("FlashloanExecutor");
const truffleConfig = require("../truffle-config.js");

module.exports = async function (deployer, network) {
    try {
        if (truffleConfig.networks[network].RPCURL === undefined){
            throw new Error(`Error: RPCURL not found on truffleconfig file for this network: ${network})`)
        } else {
            console.log(`#### Deploying contracs on ${network} running on ${truffleConfig.networks[network].RPCURL} ####`);
            await deployer.deploy(AddressCoderLib);
            await deployer.link(AddressCoderLib, FlashloanExecutor);
            await deployer.deploy(FlashloanExecutor);
        }
    } catch (e) {
        throw (`Error deploying contracts: ${e.message}`)
    }
}