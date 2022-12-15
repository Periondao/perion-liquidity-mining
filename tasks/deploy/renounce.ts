import { task } from "hardhat/config";
import {
  LiquidityMiningManager__factory,
} from "../../typechain";

const lMMAddress = ""; // TODO fill post deployment

task("renounce-deployer-role")
  .setAction(async(taskArgs, { run, ethers }) => {
    const signers = await ethers.getSigners();
    const liquidityMiningManager = new LiquidityMiningManager__factory(signers[0]).attach(lMMAddress);
    const DEFAULT_ADMIN_ROLE = await liquidityMiningManager.DEFAULT_ADMIN_ROLE();
    console.log("renouncing gov role");
    await (await liquidityMiningManager.renounceRole(DEFAULT_ADMIN_ROLE, signers[0].address)).wait(3);
    console.log("DONE");
  });
