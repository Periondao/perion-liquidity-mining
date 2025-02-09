import {
  TestFaucetToken,
  TestFaucetToken__factory,
  TimeLockNonTransferablePool,
  TimeLockNonTransferablePool__factory,
} from "../typechain";
import { constants } from "ethers";
import { parseEther } from "@ethersproject/units";
import hre, { ethers } from "hardhat";

async function deployTokens() {
  const signers = await ethers.getSigners();

  const MCToken: TestFaucetToken = await new TestFaucetToken__factory(signers[0]).deploy("Perion", "PERC");

  await MCToken.deployed();
  console.log(`MCToken deployed to ${MCToken.address}`);

  const MCETHLPToken: TestFaucetToken = await new TestFaucetToken__factory(signers[0]).deploy("Sushi V2", "SUSHI-V2");

  await MCETHLPToken.deployed();
  console.log(`MCETHLPToken deployed to ${MCETHLPToken.address}`);

  try {
    await hre.run("verify:verify", {
      address: MCToken.address,
      constructorArguments: ["Perion", "PERC"],
    });
  } catch (e) {
    console.log(e);
  }

  try {
    await hre.run("verify:verify", {
      address: MCToken.address,
      constructorArguments: ["Sushi V2", "SUSHI-V2"],
    });
  } catch (e) {
    console.log(e);
  }
}

deployTokens().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
