import { task } from "hardhat/config";
import { TimeLockNonTransferablePool, ProxyAdmin, TransparentUpgradeableProxy, View } from "../../typechain";

const ePERC = "0x0000000000000000000000000000000000000000";
const ONE_YEAR = 60 * 60 * 24 * 365;
const THREE_YEARS = ONE_YEAR * 3;
const PERC = "0x60bE1e1fE41c1370ADaF5d8e66f07Cf1C2Df2268";
const LP = "0x45b6ffb13e5206dafe2cc8780e4ddc0e32496265";
const multisig = "0x12D73beE50F0b9E06B35Fdef93E563C965796482";

task("deploy-liquidity-mining")
  .addFlag("verify")
  .setAction(async (taskArgs, { run, ethers }) => {
    const signers = await ethers.getSigners();

    // Deployment of the first proxy admin, pool implementation and proxy contract
    const percPoolProxyAdmin: ProxyAdmin = await run("deploy-proxy-admin", {
      verify: taskArgs.verify,
    });
    await percPoolProxyAdmin.deployed();

    const percPoolImplementation: TimeLockNonTransferablePool = await run(
      "deploy-time-lock-non-transferable-pool-implementation",
      {
        verify: taskArgs.verify,
      },
    );
    await percPoolImplementation.deployed();

    // Returns the same contract with two different interfaces: proxy and proxy implementation (interface of the pool)
    const [percProxy, percProxyImplementation]: [TransparentUpgradeableProxy, TimeLockNonTransferablePool] = await run(
      "deploy-proxy",
      {
        name: "Staked PERC",
        symbol: "sPERC",
        depositToken: PERC, // users stake PERC tokens
        rewardToken: PERC, // rewards is PERC token
        escrowPool: ePERC, // Rewards are locked in the escrow pool
        escrowPortion: "1", // 100% is locked
        escrowDuration: ONE_YEAR.toString(), // locked for 1 year
        maxBonus: "5", // Bonus for longer locking is 1. When locking for longest duration you'll receive 2x vs no lock limit
        maxLockDuration: THREE_YEARS.toString(), // Users can lock up to 3 years
        proxyAdmin: percPoolProxyAdmin.address,
        implementation: percPoolImplementation, // Interface of the implementation
        verify: taskArgs.verify,
      },
    );
    await percProxy.deployed();

    // Deployment of the second proxy admin, pool implementation and proxy contract
    const percLPPoolProxyAdmin: ProxyAdmin = await run("deploy-proxy-admin", {
      verify: taskArgs.verify,
    });
    await percLPPoolProxyAdmin.deployed();

    const percLPPoolImplementation: TimeLockNonTransferablePool = await run(
      "deploy-time-lock-non-transferable-pool-implementation",
      {
        verify: taskArgs.verify,
      },
    );
    await percLPPoolImplementation.deployed();

    // Returns the same contract with two different interfaces: proxy and proxy implementation (interface of the pool)
    const [percLPProxy, percLPProxyImplementation]: [TransparentUpgradeableProxy, TimeLockNonTransferablePool] =
      await run("deploy-proxy", {
        name: "Staked PERC",
        symbol: "sPERC",
        depositToken: PERC, // users stake PERC tokens
        rewardToken: PERC, // rewards is PERC token
        escrowPool: ePERC, // Rewards are locked in the escrow pool
        escrowPortion: "1", // 100% is locked
        escrowDuration: ONE_YEAR.toString(), // locked for 1 year
        maxBonus: "5", // Bonus for longer locking is 1. When locking for longest duration you'll receive 2x vs no lock limit
        maxLockDuration: THREE_YEARS.toString(), // Users can lock up to 3 years
        proxyAdmin: percLPPoolProxyAdmin.address,
        implementation: percLPPoolImplementation, // Interface of the implementation
        verify: taskArgs.verify,
      });
    await percLPProxy.deployed();

    // Deployment of the view contract
    const view: View = await run("deploy-view", {
      verify: taskArgs.verify,
    });

    const GOV_ROLE = await percProxyImplementation.GOV_ROLE();
    const DEFAULT_ADMIN_ROLE = await percProxyImplementation.GOV_ROLE();

    // Assign GOV_ROLE to deployer
    await (await percProxyImplementation.grantRole(GOV_ROLE, signers[0].address)).wait(3);
    await (await percLPProxyImplementation.grantRole(GOV_ROLE, signers[0].address)).wait(3);

    // Assign GOV_ROLE and DEFAULT_ADMIN_ROLE to multisig
    await (await percProxyImplementation.grantRole(GOV_ROLE, multisig)).wait(3);
    await (await percProxyImplementation.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);
    await (await percLPProxyImplementation.grantRole(GOV_ROLE, multisig)).wait(3);
    await (await percLPProxyImplementation.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);

    console.log("DONE");

    console.table({
      percPoolProxyAdmin: percPoolProxyAdmin.address,
      percPoolImplementation: percPoolImplementation.address,
      percProxy: percProxy.address,
      percLPPoolProxyAdmin: percLPPoolProxyAdmin.address,
      percLPPoolImplementation: percLPPoolImplementation.address,
      percLPProxy: percLPProxy.address,
      view: view.address,
    });

    console.log("❤⭕");
  });
