let AddressCoderLib = artifacts.require("AddressCoder");
let FlashloanExecutor = artifacts.require("FlashloanExecutor");
const truffleConfig = require("../truffle-config.js");

module.exports = async function (deployer, network) {
    try {
        if (truffleConfig.networks[network].host === undefined){
            throw Error(`Error: Are you deploying to the correct network? (network selected: ${network})`)
        } else {
            console.log("#### Deploying contracs on "+network+" running on "+truffleConfig.networks[network].host+":"+truffleConfig.networks[network].port+" ####");
            await deployer.deploy(AddressCoderLib);
            await deployer.link(AddressCoderLib, FlashloanExecutor);
            await deployer.deploy(FlashloanExecutor);
        }

    } catch (e) {
        console.log(`Error in migration: ${e.message}`)
    }
}