// @ts-ignore
import hre, { ethers } from "hardhat";
import { ProxyAdmin__factory, TimeLockNonTransferablePoolV2__factory } from "../typechain";

const proxyStakingContract = "0xc014286360Ef45aB15A6D3f6Bb1E54a03352aC8f";
// sPERC: 0xf64F48A4E27bBC299273532B26c83662ef776b7e
const proxyAdmin = "0x70c20550c4a481c8d044415ca0604bb5bebfc2fb";
// sPERC: 0x4c295daFEf00456c58F48122A80249E6EcF2B9f5

async function main() {
  const signer = (await ethers.getSigners())[0];
  console.log(signer.address);
  const proxyAdminContract = new ProxyAdmin__factory().attach(proxyAdmin).connect(signer);
  const newImpl = await new TimeLockNonTransferablePoolV2__factory(signer).deploy();
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
  const tx = await proxyAdminContract.upgrade(proxyStakingContract, newImpl.address);
  console.log(tx.hash);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
