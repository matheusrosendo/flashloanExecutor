let AddressCoderLib = artifacts.require("AddressCoder");
let SwapUniswapV2 = artifacts.require("SwapUniswapV2");
let FlashloanAAVEv1 = artifacts.require("FlashloanAAVEv1")
let SwapCurveV1 = artifacts.require("SwapCurveV1")
const truffleConfig = require("../truffle-config.js");

module.exports = async function (deployer, network) {
    try {
        if (truffleConfig.networks[network].host === undefined){
            throw Error(`Error: Are you deploying to the correct network? (network selected: ${network})`)
        } else {
            console.log("#### Deploying contracs on "+network+" running on "+truffleConfig.networks[network].host+":"+truffleConfig.networks[network].port+" ####");
            await deployer.deploy(AddressCoderLib);
            await deployer.deploy(SwapCurveV1);
            await deployer.link(AddressCoderLib, SwapUniswapV2);
            await deployer.link(AddressCoderLib, FlashloanAAVEv1);
            await deployer.deploy(SwapUniswapV2);
            let swapInstance = await SwapUniswapV2.deployed();
            await deployer.deploy(FlashloanAAVEv1, swapInstance.address);
        }

    } catch (e) {
        console.log(`Error in migration: ${e.message}`)
    }
}