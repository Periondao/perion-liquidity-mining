import { parseEther } from "@ethersproject/units";
import {
    ProxyAdmin,
    ProxyAdmin__factory,
    TimeLockNonTransferablePool,
    TimeLockNonTransferablePool__factory,
    TransparentUpgradeableProxy,
    TransparentUpgradeableProxy__factory
} from "../typechain";
import hre, { ethers } from "hardhat";
import * as TimeLockNonTransferablePoolJSON from "../artifacts/contracts/TimeLockNonTransferablePool.sol/TimeLockNonTransferablePool.json";

// Console input
import { createInterface } from "readline";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (questionText: string) =>
    new Promise<string>(resolve => rl.question(questionText, resolve))
        .finally(() => rl.close());



///////////////////////////////////////////////////////////////////////////////////////////////////////
// Parameters /////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
// Duration used for Escrowed Perion
const ESCROW_DURATION = 60 * 60 * 24 * 365;

// Portion of the funds that escrow (1 = 100%)
const ESCROW_PORTION = parseEther("1");

// Security measure that limits the setting of curve points
const MAX_BONUS = parseEther("5");

// Maximum duration that a lock can have
const MAX_LOCK_DURATION = 60 * 60 * 24 * 365 * 3;

// end date of the staking program
const END_DATE = 1768993200;

// Curve used for the non escrow pools
const CURVE = [
    parseEther("0"),
    parseEther("0.65"),
    parseEther("1.5"),
    parseEther("3"),
    parseEther("5")
]

// MAINNET ////////////////////////////////////////////////////////////////////////
// 0x12D73beE50F0b9E06B35Fdef93E563C965796482 | Perion Multisig
const MAINNET_MULTISIG = "0x12D73beE50F0b9E06B35Fdef93E563C965796482";
// 0x60bE1e1fE41c1370ADaF5d8e66f07Cf1C2Df2268 | Perion (PERC)
const MAINNET_PERC_TOKEN = "0x60bE1e1fE41c1370ADaF5d8e66f07Cf1C2Df2268";
// 0x45b6ffb13e5206dafe2cc8780e4ddc0e32496265 | MC/ETH Uni V2 LP (MCETHLP)
const MAINNET_PERC_ETHLP_TOKEN = "0x45b6ffb13e5206dafe2cc8780e4ddc0e32496265";
// 0x0000000000000000000000000000000000000000 | Escrowed Perion (eMC)
const MAINNET_ESCROW_POOL = "0x0000000000000000000000000000000000000000";

// TODO | Staked MC pool (sMC)
// TODO | Staked MC LP (sPERCETHLP)
///////////////////////////////////////////////////////////////////////////////////


// LOCALHOST //////////////////////////////////////////////////////////////////////
// 0x7e9e4c0876B2102F33A1d82117Cc73B7FddD0032 | Perion Multisig
const LOCALHOST_MULTISIG = "0x7e9e4c0876B2102F33A1d82117Cc73B7FddD0032";
// 0xF5aA8e3C6BA1EdF766E197a0bCD5844Fd1ed8A27 | Perion (MC)
const LOCALHOST_MC_TOKEN = "0xF5aA8e3C6BA1EdF766E197a0bCD5844Fd1ed8A27";
// 0xee85d401835561De62b874147Eca8A4Fe1D5cBFf | MC/ETH Uni V2 LP (MCETHLP)
const LOCALHOST_MCETHLP_TOKEN = "0xee85d401835561De62b874147Eca8A4Fe1D5cBFf";
// 0xd9F9304329451Dd31908BC61C0F87e2AA90aacD6 | Escrowed Perion (eMC)
const LOCALHOST_ESCROW_POOL = "0xd9F9304329451Dd31908BC61C0F87e2AA90aacD6";
///////////////////////////////////////////////////////////////////////////////////


// GORLI //////////////////////////////////////////////////////////////////////////
// 0x7e9e4c0876B2102F33A1d82117Cc73B7FddD0032 | Perion Multisig
const GORLI_MULTISIG = "0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0";
// 0x949D48EcA67b17269629c7194F4b727d4Ef9E5d6 | Perion (PERC)
const GORLI_PERC_TOKEN = "0xE14C27Cc6496f5b4471F29931337E7603D7B45C8";
// 0xcCb63225a7B19dcF66717e4d40C9A72B39331d61 | PERC/ETH Sushi LP
const GORLI_SUSHI_LP_TOKEN = "0xE14C27Cc6496f5b4471F29931337E7603D7B45C8";
// 0xfEEA44bc2161F2Fe11D55E557ae4Ec855e2D1168 | Escrowed Perion (eMC)
const GORLI_ESCROW_POOL = "0x7f817aC28ddd7976c3179E950FF0a43F9667cdD3";


let PERC_TOKEN: string;
let PERC_ETHLP_TOKEN: string;
let ESCROW_POOL: string;
let MULTISIG: string;

async function deployUpgradeable() {
    const signers = await ethers.getSigners();

    const chainChoosing = await question("Type 1 for Localhost, 2 for Mainnet or 3 for Görli: ");

    // TODO localhost and mainnet are swapped, investigate how this is supposed to function
    if (chainChoosing == "1") {
        // MAINNET ////////////////////////////////////////////////////////////////////////
        MULTISIG = MAINNET_MULTISIG;
        PERC_TOKEN = MAINNET_PERC_TOKEN;
        PERC_ETHLP_TOKEN = MAINNET_PERC_ETHLP_TOKEN;
        ESCROW_POOL = MAINNET_ESCROW_POOL;
    } else if (chainChoosing == "2") {
        // LOCALHOST //////////////////////////////////////////////////////////////////////
        MULTISIG = LOCALHOST_MULTISIG;
        PERC_TOKEN = LOCALHOST_MC_TOKEN;
        PERC_ETHLP_TOKEN = LOCALHOST_MCETHLP_TOKEN;
        ESCROW_POOL = LOCALHOST_ESCROW_POOL;
    } else if (chainChoosing == "3") {
        // GORLI //////////////////////////////////////////////////////////////////////
        MULTISIG = GORLI_MULTISIG;
        PERC_TOKEN = GORLI_PERC_TOKEN;
        PERC_ETHLP_TOKEN = GORLI_SUSHI_LP_TOKEN;
        ESCROW_POOL = GORLI_ESCROW_POOL;
    } else {
        console.log("Choose a different chain.");
        return false;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deployment of MC Pool //////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    let percPoolProxyAdmin: ProxyAdmin;
    let percPoolImplementation: TimeLockNonTransferablePool;
    let percPoolProxyDeploy: TransparentUpgradeableProxy;
    let percPoolProxy: TimeLockNonTransferablePool;

    console.log("PERC POOL DEPLOYMENT:");
    // Deploy PERCPool ProxyAdmin
    console.log("  Deploying PERC Pool ProxyAdmin");
    const PERCProxyAdmin = new ProxyAdmin__factory(signers[0]);
    percPoolProxyAdmin = (await PERCProxyAdmin.deploy());
    await percPoolProxyAdmin.deployed();
    console.log(`  PERC Pool ProxyAdmin deployed to ${percPoolProxyAdmin.address}`, '\n');


    // First deploy implementations: TimeLockNonTransferablePool
    console.log("  Deploying PERC Pool Implementation");
    const PERCPoolFactory = new TimeLockNonTransferablePool__factory(signers[0]);
    percPoolImplementation = await PERCPoolFactory.deploy();
    await percPoolImplementation.deployed();
    console.log(`  PERC Pool Implementation deployed to ${percPoolImplementation.address}`, '\n');

    const PERCPoolInitializeParams = [
        "Staked Perion",
        "sPERC",
        PERC_TOKEN,
        PERC_TOKEN,
        ESCROW_POOL,
        ESCROW_PORTION,
        ESCROW_DURATION,
        MAX_BONUS,
        MAX_LOCK_DURATION,
        END_DATE,
        CURVE
    ]

    const PERCPoolImplementationInterface = new hre.ethers.utils.Interface(JSON.stringify(TimeLockNonTransferablePoolJSON.abi))
    const PERCPool_encoded_data = PERCPoolImplementationInterface.encodeFunctionData("initialize", PERCPoolInitializeParams);

    // Deploy the proxy and initialize with specific pool parameters
    console.log("  Deploying PERC Pool Proxy");
    const PERCPoolProxyDeploy = new TransparentUpgradeableProxy__factory(signers[0]);
    const percPoolProxyContructorParams = [
        percPoolImplementation.address,
        percPoolProxyAdmin.address,
        PERCPool_encoded_data
    ];
    percPoolProxyDeploy = await PERCPoolProxyDeploy.deploy(
        percPoolImplementation.address,
        percPoolProxyAdmin.address,
        PERCPool_encoded_data
    );
    await percPoolProxyDeploy.deployed();
    console.log(`  PERC Pool Proxy deployed to ${percPoolProxyDeploy.address}`, '\n\n');
    percPoolProxy = new ethers.Contract(percPoolProxyDeploy.address, PERCPoolImplementationInterface, signers[0]) as TimeLockNonTransferablePool;





    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deployment of PERCETHLP Pool /////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    let percEthlpPoolProxyAdmin: ProxyAdmin;
    let percEthlpPoolImplementation: TimeLockNonTransferablePool;
    let percEthlpPoolProxyDeploy: TransparentUpgradeableProxy;
    let percEthlpPoolProxy: TimeLockNonTransferablePool;

    console.log("PERCETHLP POOL DEPLOYMENT:");
    // Deploy PERCPool ProxyAdmin
    console.log("  Deploying PERCETHLP Pool ProxyAdmin");
    const PERCETHLPProxyAdmin = new ProxyAdmin__factory(signers[0]);
    percEthlpPoolProxyAdmin = await PERCETHLPProxyAdmin.deploy();
    await percEthlpPoolProxyAdmin.deployed();
    console.log(`  PERCETHLP Pool ProxyAdmin deployed to ${percEthlpPoolProxyAdmin.address}`, '\n');


    // First deploy implementations: TimeLockNonTransferablePool
    console.log("  Deploying PERCETHLP Pool Implementation");
    const PERCPERCETHLPPoolFactory = new TimeLockNonTransferablePool__factory(signers[0]);
    percEthlpPoolImplementation = await PERCPERCETHLPPoolFactory.deploy();
    await percEthlpPoolImplementation.deployed();
    console.log(`  PERCETHLP Pool Implementation deployed to ${percEthlpPoolImplementation.address}`, '\n');

    const PERCETHLPPoolInitializeParams = [
        "Staked Perion Sushi LP",
        "sPERC-LP",
        PERC_ETHLP_TOKEN,
        PERC_TOKEN,
        ESCROW_POOL,
        ESCROW_PORTION,
        ESCROW_DURATION,
        MAX_BONUS,
        MAX_LOCK_DURATION,
        END_DATE,
        CURVE
    ]

    const PERCETHLPPoolImplementationInterface = new hre.ethers.utils.Interface(JSON.stringify(TimeLockNonTransferablePoolJSON.abi))
    const PERCETHLPPool_encoded_data = PERCETHLPPoolImplementationInterface.encodeFunctionData("initialize", PERCETHLPPoolInitializeParams);

    // Deploy the proxy and initialize with specific pool parameters
    console.log("  Deploying PERC-ETH-LP Pool Proxy");
    const percETHLPPoolProxyDeploy = new TransparentUpgradeableProxy__factory(signers[0]);
    const percEthlpPoolProxyContructorParams = [
        percEthlpPoolImplementation.address,
        percEthlpPoolProxyAdmin.address,
        PERCETHLPPool_encoded_data
    ];
    percEthlpPoolProxyDeploy = await percETHLPPoolProxyDeploy.deploy(
        percEthlpPoolImplementation.address,
        percEthlpPoolProxyAdmin.address,
        PERCETHLPPool_encoded_data
    );
    await percEthlpPoolProxyDeploy.deployed();
    console.log(`  PERCETHLP Pool Proxy deployed to ${percEthlpPoolProxyDeploy.address}`, '\n\n');
    percEthlpPoolProxy = new ethers.Contract(percEthlpPoolProxyDeploy.address, PERCETHLPPoolImplementationInterface, signers[0]) as TimeLockNonTransferablePool;



    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Role assignment ////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log("Assigning roles:");
    const GOV_ROLE = await percPoolProxy.GOV_ROLE();
    const DEFAULT_ADMIN_ROLE = await percPoolProxy.DEFAULT_ADMIN_ROLE();

    console.log(`  MULTISIG (${MULTISIG}) recieved GOV_ROLE of PERCPoolProxy (${percPoolProxy.address})`);
    await (await percPoolProxy.grantRole(GOV_ROLE, MULTISIG)).wait(1);
    const govRolePercPool = await percPoolProxy.hasRole(GOV_ROLE, MULTISIG);

    console.log(`  MULTISIG (${MULTISIG}) received DEFAULT_ADMIN_ROLE of PERCPoolProxy (${percPoolProxy.address})`);
    await (await percPoolProxy.grantRole(DEFAULT_ADMIN_ROLE, MULTISIG)).wait(1);
    const adminRolePercPool = await percPoolProxy.hasRole(DEFAULT_ADMIN_ROLE, MULTISIG);

    console.log(`  MULTISIG (${MULTISIG}) recieved GOV_ROLE of percEthlpPoolProxy (${percEthlpPoolProxy.address})`);
    await (await percEthlpPoolProxy.grantRole(GOV_ROLE, MULTISIG)).wait(1);
    const govRolePercEthlpPool = await percEthlpPoolProxy.hasRole(GOV_ROLE, MULTISIG);

    console.log(`  MULTISIG (${MULTISIG}) recieved DEFAULT_ADMIN_ROLE of percEthlpPoolProxy (${percEthlpPoolProxy.address})`, '\n\n');
    await (await percEthlpPoolProxy.grantRole(DEFAULT_ADMIN_ROLE, MULTISIG)).wait(1);
    const adminRolePercEthlpPool = await percEthlpPoolProxy.hasRole(DEFAULT_ADMIN_ROLE, MULTISIG);

    console.log("CHECK MANUALLY IF EVERYTHING IS CORRECTLY SETUP:");
    console.log(`  -MULTISIG has GOV_ROLE in both pools: ${govRolePercPool}, ${govRolePercEthlpPool}`);
    console.log(`  -MULTISIG has DEFAULT_ADMIN_ROLE in both pools: ${adminRolePercPool}, ${adminRolePercEthlpPool}`, '\n');

    console.log("THEN WITH THE DEPLOYER:");
    console.log("  -deposit for 3 years more than $100 PERC in PERC Pool");
    console.log("  -deposit for 3 years more than $100 LP in LP Pool");
    console.log("  -transfer ownership to MULTISIG in percPoolProxyAdmin and percEthlpPoolProxyAdmin");
    console.log("  -renounce DEFAULT_ADMIN_ROLE in both pools", '\n');

    console.log("❤⭕");


    // //////////////////////////////////////////////////////////////////////////////////////////////////// VERIFY contracts


    // Verify PERC Pool Proxy
    try {
        await hre.run("verify:verify", {
            address: percPoolProxyDeploy.address,
            constructorArguments: percPoolProxyContructorParams
        });
    } catch (e) {
        console.log(e);
    }

    // Verify PERC Pool Implementation
    try {
        await hre.run("verify:verify", {
            address: percPoolImplementation.address,
            constructorArguments: []
        });
    } catch (e) {
        console.log(e);
    }
    // Verify PERC Pool ProxyAdmin
    try {
        await hre.run("verify:verify", {
            address: percPoolProxyAdmin.address,
            constructorArguments: []
        });
    } catch (e) {
        console.log(e);
    }

    // Verify PERCETHLP Pool Proxy
    try {
        await hre.run("verify:verify", {
            address: percPoolProxyDeploy.address,
            constructorArguments: percEthlpPoolProxyContructorParams
        });
    } catch (e) {
        console.log(e);
    }
    // Verify PERCETHLP Pool Implementation
    try {
        await hre.run("verify:verify", {
            address: percEthlpPoolImplementation.address,
            constructorArguments: []
        });
    } catch (e) {
        console.log(e);
    }
    // Verify PERCETHLP Pool ProxyAdmin
    try {
        await hre.run("verify:verify", {
            address: percEthlpPoolProxyAdmin.address,
            constructorArguments: []
        });
    } catch (e) {
        console.log(e);
    }

}

deployUpgradeable().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
