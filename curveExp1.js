const curvefi = require("@curvefi/api");
const curve = curvefi.default;

(async () => {
    console.log("####### START CURVE DEV ########");
    
    // 1. Dev
    await curve.init('JsonRpc', {url: 'http://127.0.0.1:8005/', privateKey: 'f3ce236978501cac7bca07ab5cf7700899eb3e2435c6d94e0d3bd346355f53f3'}, { gasPrice: 0, maxFeePerGas: 0, maxPriorityFeePerGas: 0, chainId: 1337 });
    //await curve.init("Infura", { network: "homestead", apiKey: '2b87a1cd9a75478288b5a54b40c62cdc' }, { chainId: 1 });
    
    //get balances
    let balances = await curve.getBalances(['USDT', 'aDAI'])

    // Fetch factory pools
    let pools = await curve.getPoolList();
    console.log(pools);

    //get addresss of a pool
    let specificPool = curve.getPool("3pool");
    let specificPoolAddr = specificPool.address;
    console.log("specificPoolAddr: "+specificPoolAddr);
    

    //let tvl = await curve.getTVL();
    //console.log("tvl = "+tvl);
    //await curve.getCryptoFactoryPoolList();
})()