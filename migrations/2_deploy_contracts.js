let Flashloan = artifacts.require("Flashloan")
const truffleconfig = require("../truffle-config.js");

module.exports = async function (deployer, network) {
    try {

        let lendingPoolAddressesProviderAddress;
        console.log("lendingPoolAddressesProviderAddress: "+truffleconfig.networks[network].lendingPoolAddressesProviderAddress)
        
        if (truffleconfig.networks[network].lendingPoolAddressesProviderAddress === undefined){
            throw Error(`Are you deploying to the correct network? (network selected: ${network})`)
        } else {
            await deployer.deploy(Flashloan, truffleconfig.networks[network].lendingPoolAddressesProviderAddress)
        }

    } catch (e) {
        console.log(`Error in migration: ${e.message}`)
    }
}