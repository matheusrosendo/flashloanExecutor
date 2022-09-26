let AddressCoderLib = artifacts.require("AddressCoder");
let SwapUniswapV2 = artifacts.require("SwapUniswapV2");
let FlashloanAAVEv1 = artifacts.require("FlashloanAAVEv1")
const config = require("../config.json");

module.exports = async function (deployer, network) {
    try {
        await deployer.deploy(AddressCoderLib);
        await deployer.link(AddressCoderLib, SwapUniswapV2);
        await deployer.link(AddressCoderLib, FlashloanAAVEv1);
        await deployer.deploy(SwapUniswapV2);
        let swapInstance = await SwapUniswapV2.deployed();
        console.log("AAVEv1lendingPoolAddressesProviderAddress: "+config.AAVEv1lendingPoolAddressesProviderAddress)
        if (config.AAVEv1lendingPoolAddressesProviderAddress === undefined){
            throw Error(`Are you deploying to the correct network? (network selected: ${network})`)
        } else {
            await deployer.deploy(FlashloanAAVEv1, config.AAVEv1lendingPoolAddressesProviderAddress, swapInstance.address);
        }

    } catch (e) {
        console.log(`Error in migration: ${e.message}`)
    }
}