let FlashloanAAVEv1 = artifacts.require("FlashloanAAVEv1")
const truffleconfig = require("../truffle-config.js");

module.exports = async function (deployer, network) {
    try {

        console.log("lendingPoolAddressesProviderAddress: "+truffleconfig.networks[network].AAVEv1lendingPoolAddressesProviderAddress)
        
        if (truffleconfig.networks[network].AAVEv1lendingPoolAddressesProviderAddress === undefined){
            throw Error(`Are you deploying to the correct network? (network selected: ${network})`)
        } else {
            await deployer.deploy(FlashloanAAVEv1, truffleconfig.networks[network].AAVEv1lendingPoolAddressesProviderAddress)
        }

    } catch (e) {
        console.log(`Error in migration: ${e.message}`)
    }
}