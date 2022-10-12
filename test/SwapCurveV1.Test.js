require("dotenv").config({path: "../.env"});
let SwapUniswapV2 = artifacts.require("SwapUniswapV2");
const chai = require("./setupChai.js"); 
const BigNumber = web3.utils.BN;
const expect = chai.expect;
const Web3 = require('web3');
const truffleConfig = require("../truffle-config.js");
let web3Instance;

function getWeb3Instance(_network){
    try {       
        if(web3Instance === undefined){
            web3Instance = new Web3("http://"+truffleConfig.networks[_network].host+":"+truffleConfig.networks[_network].port);
        }
    } catch (error) {
        console.log("Error to connect to "+_network+" "+error);  
    }
    return  web3Instance; 
}

contract ("SwapUniswapV2 Test", async (deployer, network, accounts) => {
    //const [ initialHolder, recipient, anotherAccount ] = accounts;
    console.log(deployer);
    console.log(network);
    console.log(accounts);
    
    let Web3js = getWeb3Instance(network);   

    //call before each test unit, it can redeploy de contract
    beforeEach( async() => {
        this.redeployedSwapUniswapV2 = await SwapUniswapV2.new();
    })

    it("initial DAI balance must be 0", async() => {
        let instance = await this.redeployedSwapUniswapV2;
        
        return await expect(instance.balanceOfToken("0x6B175474E89094C44Da98b954EedeAC495271d0F")).to.eventually.be.a.bignumber.equal(new BigNumber(0));
    });

    

})

