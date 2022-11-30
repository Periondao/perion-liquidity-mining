import { task } from "hardhat/config";

import { LiquidityMiningManager, TimeLockNonTransferablePool, View } from "../../typechain";
import sleep from "../../utils/sleep";
import { constants, utils } from "ethers";
import { captureRejectionSymbol } from "events";

const PERC = "0x60bE1e1fE41c1370ADaF5d8e66f07Cf1C2Df2268";
const LP = "0x45b6ffb13e5206dafe2cc8780e4ddc0e32496265";
const multisig = "0x12D73beE50F0b9E06B35Fdef93E563C965796482";
const THREE_YEARS = (60 * 60 * 24 * 365) * 3;

task("deploy-liquidity-mining")
    .addFlag("verify")
    .setAction(async(taskArgs, { run, ethers }) => {
    const signers = await ethers.getSigners();
    const liquidityMiningManager:LiquidityMiningManager = await run("deploy-liquidity-mining-manager", {
        rewardToken: PERC,
        rewardSource: multisig, //multi sig is where the rewards will be stored.
        verify: taskArgs.verify
    });

    // await liquidityMiningManager.deployed();

    const escrowPool:TimeLockNonTransferablePool = await run("deploy-time-lock-non-transferable-pool", {
        name: "Escrowed Perion",
        symbol: "ePERC",
        depositToken: PERC,
        rewardToken: PERC, // leaves possibility for xSushi like payouts on staked PERC
        escrowPool: constants.AddressZero,
        escrowPortion: "0", // rewards from pool itself are not locked
        escrowDuration: "0", // no rewards escrowed so 0 escrow duration
        maxBonus: "0", // no bonus needed for longer locking durations
        maxLockDuration: (THREE_YEARS * 10).toString(), // Can be used to lock up to 3 years
        verify: taskArgs.verify
    });

    // await escrowPool.deployed();

    const mcPool:TimeLockNonTransferablePool = await run("deploy-time-lock-non-transferable-pool", {
        name: "Staked Perion",
        symbol: "sPERC",
        depositToken: PERC, // users stake PERC tokens
        rewardToken: PERC, // rewards is PERC token
        escrowPool: escrowPool.address, // Rewards are locked in the escrow pool
        escrowPortion: "1", // 100% is locked
        escrowDuration: THREE_YEARS.toString(), // locked for 1 year
        maxBonus: "5", // Bonus for longer locking is 1. When locking for longest duration you'll receive 5x
        maxLockDuration: THREE_YEARS.toString(), // Users can lock up to 3 years
        verify: taskArgs.verify
    });

    // await mcPool.deployed();

    const mcLPPool:TimeLockNonTransferablePool = await run("deploy-time-lock-non-transferable-pool", {
        name: "Staked Perc Sushi LP",
        symbol: "sPERCPOOL",
        depositToken: LP, // users stake LP tokens
        rewardToken: PERC, // rewards is PERC token
        escrowPool: escrowPool.address, // Rewards are locked in the escrow pool
        escrowPortion: "1", // 100% is locked
        escrowDuration: THREE_YEARS.toString(), // locked for 3 years
        maxBonus: "5", // Bonus for longer locking is 1. When locking for longest duration you'll receive 5x
        maxLockDuration: THREE_YEARS.toString(), // Users can lock up to 3 years
        verify: taskArgs.verify
    });

    // await mcLPPool.deployed();

    const view:View = await run("deploy-view", {
        liquidityMiningManager: liquidityMiningManager.address,
        escrowPool: escrowPool.address,
        verify: taskArgs.verify
    });


    // assign gov role to deployer
    const GOV_ROLE = await liquidityMiningManager.GOV_ROLE();
    const REWARD_DISTRIBUTOR_ROLE = await liquidityMiningManager.REWARD_DISTRIBUTOR_ROLE();
    const DEFAULT_ADMIN_ROLE = await liquidityMiningManager.DEFAULT_ADMIN_ROLE();
    (await (await liquidityMiningManager.grantRole(GOV_ROLE, signers[0].address)).wait(3));
    (await (await liquidityMiningManager.grantRole(REWARD_DISTRIBUTOR_ROLE, signers[0].address)).wait(3));

    // Add pools
    console.log("Adding PERC Pool");
    await (await liquidityMiningManager.addPool(mcPool.address, utils.parseEther("0.2"))).wait(3);
    console.log("Adding PERC LP Pool");
    await (await liquidityMiningManager.addPool(mcLPPool.address, utils.parseEther("0.8"))).wait(3);

    // Assign GOV, DISTRIBUTOR and DEFAULT_ADMIN roles to multisig
    console.log("setting lmm roles");
    // renounce gov role from deployer
    console.log("renouncing gov role");
    await (await liquidityMiningManager.renounceRole(GOV_ROLE, signers[0].address)).wait(3);
    console.log("renouncing distributor role");
    await (await liquidityMiningManager.renounceRole(REWARD_DISTRIBUTOR_ROLE, signers[0].address)).wait(3);
    console.log("Assigning GOV_ROLE");
    await (await liquidityMiningManager.grantRole(GOV_ROLE, multisig)).wait(3);
    console.log("Assigning REWARD_DISTRIBUTOR_ROLE");
    await (await liquidityMiningManager.grantRole(REWARD_DISTRIBUTOR_ROLE, multisig)).wait(3);
    console.log("Assigning DEFAULT_ADMIN_ROLE");
    await (await liquidityMiningManager.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);

    console.log("Assigning DEFAULT_ADMIN roles on pools");
    await (await escrowPool.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);
    await (await mcPool.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);
    await (await mcLPPool.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);

    console.log("DONE");

    console.table({
        liquidityMiningManager: liquidityMiningManager.address,
        escrowPool: escrowPool.address,
        mcPool: mcPool.address,
        mcLPPool: mcLPPool.address,
        view: view.address
    });

    console.log("CHECK IF EVERYTHING IS CORRECTLY SETUP AND THEN RENOUNCE THE DEFAULT_ADMIN_ROLE and pools ON THE liquidityMiningManager CONTRACT FROM THE DEPLOYER ADDRESS");
    console.log("❤⭕");
});
