import { parseEther } from "@ethersproject/units";
import {
  ProxyAdmin,
  ProxyAdmin__factory,
  TimeLockNonTransferablePool,
  TimeLockNonTransferablePool__factory,
  TransparentUpgradeableProxy,
  TransparentUpgradeableProxy__factory,
} from "../typechain";
import hre, { ethers } from "hardhat";
import * as TimeLockNonTransferablePoolJSON from "../artifacts/contracts/TimeLockNonTransferablePool.sol/TimeLockNonTransferablePool.json";

// Console input
import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (questionText: string) =>
  new Promise<string>(resolve => rl.question(questionText, resolve)).finally(() => rl.close());

///////////////////////////////////////////////////////////////////////////////////////////////////////
// Parameters /////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
// Duration used for Escrowed Perion
const ESCROW_DURATION = 0;

// Portion of the funds that escrow (1 = 100%)
const ESCROW_PORTION = parseEther("0");

const MAX_BONUS = parseEther("36");

// Maximum duration that a lock can have
const MAX_LOCK_DURATION = 60 * 60 * 24 * 365 * 3;

// end date of the staking program
const END_DATE = 1864558800; // 1 Feb 2029

// MAINNET ////////////////////////////////////////////////////////////////////////
// 0x12D73beE50F0b9E06B35Fdef93E563C965796482 | Perion Multisig
const MAINNET_MULTISIG = "0x12D73beE50F0b9E06B35Fdef93E563C965796482";
// 0x60bE1e1fE41c1370ADaF5d8e66f07Cf1C2Df2268 | Perion (PERC)
const MAINNET_PERC_TOKEN = "0x60bE1e1fE41c1370ADaF5d8e66f07Cf1C2Df2268";
// 0x45b6ffb13e5206dafe2cc8780e4ddc0e32496265 | MC/ETH Uni V2 LP (MCETHLP)
const MAINNET_PERC_ETHLP_TOKEN = "0x45b6ffb13e5206dafe2cc8780e4ddc0e32496265";
// 0x0000000000000000000000000000000000000000 | Escrowed Perion (eMC)
const MAINNET_ESCROW_POOL = "0x0000000000000000000000000000000000000000";
// 0xf64F48A4E27bBC299273532B26c83662ef776b7e | sPERC
const MAINNET_SPERC = "0xf64F48A4E27bBC299273532B26c83662ef776b7e";
// 0xc014286360Ef45aB15A6D3f6Bb1E54a03352aC8f | SLP PERC
const MAINNET_SLP_PERC = "0xc014286360Ef45aB15A6D3f6Bb1E54a03352aC8f"
// admin account TODO
const ADMIN = "0xEdd6D7ba0FF9f4bC501a12529cb736CA76A4fe7e";

// LOCALHOST //////////////////////////////////////////////////////////////////////
// 0x7e9e4c0876B2102F33A1d82117Cc73B7FddD0032 | Perion Multisig
const LOCALHOST_MULTISIG = "0x7e9e4c0876B2102F33A1d82117Cc73B7FddD0032";
// 0xF5aA8e3C6BA1EdF766E197a0bCD5844Fd1ed8A27 | Perion (MC)
const LOCALHOST_MC_TOKEN = "0xF5aA8e3C6BA1EdF766E197a0bCD5844Fd1ed8A27";
// 0xee85d401835561De62b874147Eca8A4Fe1D5cBFf | MC/ETH Uni V2 LP (MCETHLP)
const LOCALHOST_MCETHLP_TOKEN = "0xee85d401835561De62b874147Eca8A4Fe1D5cBFf";
// 0xd9F9304329451Dd31908BC61C0F87e2AA90aacD6 | Escrowed Perion (eMC)
const LOCALHOST_ESCROW_POOL = "0xd9F9304329451Dd31908BC61C0F87e2AA90aacD6";
// 0xf64F48A4E27bBC299273532B26c83662ef776b7e | sPERC
const LOCALHOST_SPERC = "0xf64F48A4E27bBC299273532B26c83662ef776b7e";
// 0xc014286360Ef45aB15A6D3f6Bb1E54a03352aC8f | SLP PERC
const LOCALHOST_SLP_PERC = "0xc014286360Ef45aB15A6D3f6Bb1E54a03352aC8f"
///////////////////////////////////////////////////////////////////////////////////

// GORLI //////////////////////////////////////////////////////////////////////////
// 0x7e9e4c0876B2102F33A1d82117Cc73B7FddD0032 | Perion Multisig
const GORLI_MULTISIG = "0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0";
// 0x949D48EcA67b17269629c7194F4b727d4Ef9E5d6 | Perion (PERC)
const GORLI_PERC_TOKEN = "0xE14C27Cc6496f5b4471F29931337E7603D7B45C8";
// 0xcCb63225a7B19dcF66717e4d40C9A72B39331d61 | PERC/ETH Sushi LP
const GORLI_SUSHI_LP_TOKEN = "0x602f8d6b7af4f287d9aeb9340456b252047ddd66";
// 0xfEEA44bc2161F2Fe11D55E557ae4Ec855e2D1168 | Escrowed Perion (eMC)
const GORLI_ESCROW_POOL = "0x0000000000000000000000000000000000000000";
// 0xf64F48A4E27bBC299273532B26c83662ef776b7e | sPERC
const GORLI_SPERC = "0xf64F48A4E27bBC299273532B26c83662ef776b7e";
// 0xc014286360Ef45aB15A6D3f6Bb1E54a03352aC8f | SLP PERC
const GORLI_SLP_PERC = "0xc014286360Ef45aB15A6D3f6Bb1E54a03352aC8f"

let PERC_TOKEN: string;
let PERC_ETHLP_TOKEN: string;
let ESCROW_POOL: string;
let MULTISIG: string;
let SPERC: string;
let SLP_PERC: string;

async function deployUpgradeable() {
  const signers = await ethers.getSigners();

  const chainChoosing = await question("Type 1 for Localhost, 2 for Mainnet or 3 for Görli: ");

  if (chainChoosing == "1") {
    // MAINNET ////////////////////////////////////////////////////////////////////////
    MULTISIG = MAINNET_MULTISIG;
    PERC_TOKEN = MAINNET_PERC_TOKEN;
    PERC_ETHLP_TOKEN = MAINNET_PERC_ETHLP_TOKEN;
    ESCROW_POOL = MAINNET_ESCROW_POOL;
    SPERC = MAINNET_SPERC;
    SLP_PERC = MAINNET_SLP_PERC;
  } else if (chainChoosing == "2") {
    // LOCALHOST //////////////////////////////////////////////////////////////////////
    MULTISIG = LOCALHOST_MULTISIG;
    PERC_TOKEN = LOCALHOST_MC_TOKEN;
    PERC_ETHLP_TOKEN = LOCALHOST_MCETHLP_TOKEN;
    ESCROW_POOL = LOCALHOST_ESCROW_POOL;
    SPERC = LOCALHOST_SPERC;
    SLP_PERC = LOCALHOST_SLP_PERC;
  } else if (chainChoosing == "3") {
    // GORLI //////////////////////////////////////////////////////////////////////
    MULTISIG = GORLI_MULTISIG;
    PERC_TOKEN = GORLI_PERC_TOKEN;
    PERC_ETHLP_TOKEN = GORLI_SUSHI_LP_TOKEN;
    ESCROW_POOL = GORLI_ESCROW_POOL;
    SPERC = GORLI_SPERC;
    SLP_PERC = GORLI_SLP_PERC;
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

  const PERCProxyAdmin = new ProxyAdmin__factory(signers[0]);
  percPoolProxyAdmin = await PERCProxyAdmin.attach(SPERC);

  // First deploy implementations: TimeLockNonTransferablePool
  console.log("  Deploying PERC Pool Implementation");
  const PERCPoolFactory = new TimeLockNonTransferablePool__factory(signers[0]);
  percPoolImplementation = await PERCPoolFactory.deploy();
  await percPoolImplementation.deployed();
  console.log(`  PERC Pool Implementation deployed to ${percPoolImplementation.address}`, "\n");

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
    ADMIN
  ];

  const PERCPoolImplementationInterface = new hre.ethers.utils.Interface(
    JSON.stringify(TimeLockNonTransferablePoolJSON.abi),
  );
  const PERCPool_encoded_data = PERCPoolImplementationInterface.encodeFunctionData(
    "initialize",
    PERCPoolInitializeParams,
  );

  // Deploy the proxy and initialize with specific pool parameters
  const PERCPoolProxyDeploy = new TransparentUpgradeableProxy__factory(signers[0]);
  percPoolProxyDeploy = PERCPoolProxyDeploy.attach(SPERC);

  // upgrade to the new implementation
  // TODO this would need to be done via the multisig interface
  await percPoolProxyDeploy.upgradeToAndCall(percPoolImplementation.address, PERCPool_encoded_data);

  ///////////////////////////////////////////////////////////////////////////////////////////////////////
  // Deployment of PERCETHLP Pool /////////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////////////////////////////
  let percEthlpPoolProxyAdmin: ProxyAdmin;
  let percEthlpPoolImplementation: TimeLockNonTransferablePool;
  let percEthlpPoolProxyDeploy: TransparentUpgradeableProxy;
  let percEthlpPoolProxy: TimeLockNonTransferablePool;

  // Deploy PERCPool ProxyAdmin
  const PERCETHLPProxyAdmin = new ProxyAdmin__factory(signers[0]);
  percEthlpPoolProxyAdmin = await PERCETHLPProxyAdmin.attach(SLP_PERC);

  // First deploy implementations: TimeLockNonTransferablePool
  console.log("  Deploying PERCETHLP Pool Implementation");
  const PERCPERCETHLPPoolFactory = new TimeLockNonTransferablePool__factory(signers[0]);
  percEthlpPoolImplementation = await PERCPERCETHLPPoolFactory.deploy();
  await percEthlpPoolImplementation.deployed();
  console.log(`  PERCETHLP Pool Implementation deployed to ${percEthlpPoolImplementation.address}`, "\n");

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
    ADMIN
  ];

  const PERCETHLPPoolImplementationInterface = new hre.ethers.utils.Interface(
    JSON.stringify(TimeLockNonTransferablePoolJSON.abi),
  );
  const PERCETHLPPool_encoded_data = PERCETHLPPoolImplementationInterface.encodeFunctionData(
    "initialize",
    PERCETHLPPoolInitializeParams,
  );

  console.log(PERCETHLPPool_encoded_data);

  // example: https://goerli.etherscan.io/tx/0x206452d6457109e8a66ceeb4c90c2313c8383f85e933607c1baeb40eac550cee
  console.log("Implementations deployed, upgrade via the ProxyAdmin upgradeAndCall");
}

deployUpgradeable().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
