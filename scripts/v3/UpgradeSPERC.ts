// @ts-ignore
import hre, { ethers } from "hardhat";
import { ProxyAdmin__factory } from "../../typechain";
import { TimeLockNonTransferablePoolV3__factory } from "../../typechain";
import { parseEther } from "@ethersproject/units";

const MAINNET_PERC_TOKEN = "0x60bE1e1fE41c1370ADaF5d8e66f07Cf1C2Df2268";
const MAINNET_ESCROW_POOL = "0x0000000000000000000000000000000000000000";
const ESCROW_DURATION = 0;
// Portion of the funds that escrow (1 = 100%)
const ESCROW_PORTION = parseEther("0");
const MAX_BONUS = parseEther("36");
// Maximum duration that a lock can have
const MAX_LOCK_DURATION = 60 * 60 * 24 * 365 * 3;
// end date of the staking program
const END_DATE = 1865116800; // 7 Feb 2029

const proxyStakingContract = "0xf64F48A4E27bBC299273532B26c83662ef776b7e";
const proxyAdmin = "0x4c295daFEf00456c58F48122A80249E6EcF2B9f5";

async function main() {
  const signer = (await ethers.getSigners())[0];
  console.log(signer.address);
  const proxyAdminContract = new ProxyAdmin__factory().attach(proxyAdmin).connect(signer);
  const newImpl = await new TimeLockNonTransferablePoolV3__factory(signer).deploy();
  await newImpl.deployed();
  console.log("new contract: ", newImpl.address);
  try {
    await hre.run("verify:verify", {
      address: newImpl.address,
      constructorArguments: [],
    });
  } catch (e) {
    console.log(e);
  }

  const PERCETHLPPoolImplementationInterface = new ethers.utils.Interface(
    JSON.stringify(TimeLockNonTransferablePoolV3__factory.abi),
  );


  const PERCPoolInitializeParams = [
    "Staked Perion",
    "sPERC",
    MAINNET_PERC_TOKEN,
    MAINNET_PERC_TOKEN,
    MAINNET_ESCROW_POOL,
    ESCROW_PORTION,
    ESCROW_DURATION,
    MAX_BONUS,
    MAX_LOCK_DURATION,
    END_DATE,
  ];

  const PERCETHLPPool_encoded_data = PERCETHLPPoolImplementationInterface.encodeFunctionData(
    "initialize",
    PERCPoolInitializeParams,
  );

  const tx = await proxyAdminContract.upgradeAndCall(proxyStakingContract, newImpl.address, PERCETHLPPool_encoded_data);

  // 28 days ago (28 * 942.4)
  await newImpl.attach(proxyStakingContract).connect(signer).distributeRewards(parseEther("15344"));

  console.log(tx.hash);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
