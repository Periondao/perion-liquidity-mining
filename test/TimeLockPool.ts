import { parseEther, formatEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, constants, Contract } from "ethers";
import hre, { ethers } from "hardhat";
import { View__factory, TestToken__factory, TestTimeLockPool__factory } from "../typechain";
import { View, TestToken, TimeLockPool, TestTimeLockPool, ProxyAdmin, TransparentUpgradeableProxy } from "../typechain";
import TimeTraveler from "../utils/TimeTraveler";
const ESCROW_DURATION = 60 * 60 * 24 * 365;
const ESCROW_PORTION = parseEther("0.77");
const MAX_BONUS = parseEther("10");
const MAX_BONUS_ESCROW = parseEther("1");
const MAX_LOCK_DURATION = 60 * 60 * 24 * 365 * 3;
const END_DATE = 9999999999;
const INITIAL_MINT = parseEther("1000000");

describe("TimeLockPool", function () {
  let deployer: SignerWithAddress;
  let account1: SignerWithAddress;
  let account2: SignerWithAddress;
  let account3: SignerWithAddress;
  let account4: SignerWithAddress;
  let signers: SignerWithAddress[];

  let depositToken: TestToken;
  let rewardToken: TestToken;
  let timeLockPool: Contract;
  let testTimeLockPoolImplementation: TimeLockPool;
  let escrowPool: TestTimeLockPool;
  let proxyAdmin: ProxyAdmin;
  let proxy: TransparentUpgradeableProxy;

  const timeTraveler = new TimeTraveler(hre.network.provider);

  before(async () => {
    [deployer, account1, account2, account3, account4, ...signers] = await hre.ethers.getSigners();

    const testTokenFactory = await new TestToken__factory(deployer);

    depositToken = await testTokenFactory.deploy("DPST", "Deposit Token");
    rewardToken = await testTokenFactory.deploy("RWRD", "Reward Token");

    await depositToken.mint(account1.address, INITIAL_MINT);
    await rewardToken.mint(account1.address, INITIAL_MINT);

    // Deploy to use its address as input in the initializer parameters of the implementation
    const testTimeLockPoolFactory = new TestTimeLockPool__factory(deployer);

    escrowPool = await testTimeLockPoolFactory.deploy(
      "ESCROW",
      "ESCRW",
      rewardToken.address,
      constants.AddressZero,
      constants.AddressZero,
      0,
      0,
      MAX_BONUS_ESCROW,
      ESCROW_DURATION,
      END_DATE,
    );

    // Deploy the TimeLockPool implementation
    //const timeLockPoolFactory = new TestTimeLockPool__factory(deployer);
    timeLockPool = await testTimeLockPoolFactory.deploy(
      "Staking Pool",
      "STK",
      depositToken.address,
      rewardToken.address,
      escrowPool.address,
      ESCROW_PORTION.div(2),
      ESCROW_DURATION * 2,
      MAX_BONUS.mul(10),
      MAX_LOCK_DURATION,
      END_DATE,
    );

    const GOV_ROLE = await timeLockPool.GOV_ROLE();
    await timeLockPool.grantRole(GOV_ROLE, deployer.address);

    // connect account1 to all contracts
    timeLockPool = timeLockPool.connect(account1);
    escrowPool = escrowPool.connect(account1);
    depositToken = depositToken.connect(account1);
    rewardToken = rewardToken.connect(account1);

    await depositToken.approve(timeLockPool.address, constants.MaxUint256);

    await timeTraveler.snapshot();
  });

  beforeEach(async () => {
    await timeTraveler.revertSnapshot();
  });

  describe("deposit", async () => {
    const DEPOSIT_AMOUNT = parseEther("10");

    it("Depositing with no lock should lock it for 10 minutes to prevent flashloans", async () => {
      await timeLockPool.deposit(DEPOSIT_AMOUNT, 0, account3.address);
      const MIN_LOCK_DURATION = await timeLockPool.MIN_LOCK_DURATION();
      const deposit = await timeLockPool.depositsOf(account3.address, 0);
      const duration = await deposit.end.sub(deposit.start);
      expect(duration).to.eq(MIN_LOCK_DURATION);
    });

    it("should not allow users to deposit past the end date", async () => {
      await timeTraveler.setNextBlockTimestamp(END_DATE);
      const tx = timeLockPool.deposit(DEPOSIT_AMOUNT, 0, account3.address);
      await expect(tx).to.be.revertedWith("ProgramExpiredError()");
    });

    it("should not allow the deposit duration to exceed the end date", async () => {
      const MIN_LOCK_DURATION = await timeLockPool.MIN_LOCK_DURATION();
      await timeTraveler.setNextBlockTimestamp(END_DATE - MIN_LOCK_DURATION * 3);
      await timeLockPool.deposit(DEPOSIT_AMOUNT, MIN_LOCK_DURATION * 4, account3.address);
      const deposit = await timeLockPool.depositsOf(account3.address, 0);
      expect(deposit.end).to.equal(END_DATE);
    });

    it("Deposit with no lock", async () => {
      const depositTokenBalanceBefore = await depositToken.balanceOf(account1.address);
      await timeLockPool.deposit(DEPOSIT_AMOUNT, 0, account3.address);
      const depositTokenBalanceAfter = await depositToken.balanceOf(account1.address);

      const deposit = await timeLockPool.depositsOf(account3.address, 0);
      const depositCount = await timeLockPool.getDepositsOfLength(account3.address);
      const blockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
      const totalDeposit = await timeLockPool.getTotalDeposit(account3.address);
      const timeLockPoolBalance = await timeLockPool.balanceOf(account3.address);
      const MIN_LOCK_DURATION = await timeLockPool.MIN_LOCK_DURATION();

      const multiplier = await timeLockPool.getMultiplier(MIN_LOCK_DURATION);

      expect(deposit.amount).to.eq(DEPOSIT_AMOUNT);
      expect(deposit.start).to.eq(blockTimestamp);
      expect(deposit.end).to.eq(BigNumber.from(blockTimestamp).add(MIN_LOCK_DURATION));
      expect(depositCount).to.eq(1);
      expect(totalDeposit).to.eq(DEPOSIT_AMOUNT);
      expect(timeLockPoolBalance).to.eq(DEPOSIT_AMOUNT.mul(multiplier).div(constants.WeiPerEther));
      expect(depositTokenBalanceAfter).to.eq(depositTokenBalanceBefore.sub(DEPOSIT_AMOUNT));
    });
    it("Trying to lock for longer than max duration should lock for max duration", async () => {
      const depositTokenBalanceBefore = await depositToken.balanceOf(account1.address);
      await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account3.address);
      const depositTokenBalanceAfter = await depositToken.balanceOf(account1.address);

      const deposit = await timeLockPool.depositsOf(account3.address, 0);
      const depositCount = await timeLockPool.getDepositsOfLength(account3.address);
      const blockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
      const totalDeposit = await timeLockPool.getTotalDeposit(account3.address);
      const timeLockPoolBalance = await timeLockPool.balanceOf(account3.address);
      const maxMultiplier = await timeLockPool.getMultiplier(MAX_LOCK_DURATION);

      expect(deposit.amount).to.eq(DEPOSIT_AMOUNT);
      expect(deposit.start).to.eq(blockTimestamp);
      expect(deposit.end).to.eq(BigNumber.from(blockTimestamp).add(MAX_LOCK_DURATION));
      expect(depositCount).to.eq(1);
      expect(totalDeposit).to.eq(DEPOSIT_AMOUNT);
      expect(timeLockPoolBalance).to.eq(DEPOSIT_AMOUNT.mul(maxMultiplier).div(constants.WeiPerEther));

      expect(depositTokenBalanceAfter).to.eq(depositTokenBalanceBefore.sub(DEPOSIT_AMOUNT));
    });
    it("Multiple deposits", async () => {
      const depositTokenBalanceBefore = await depositToken.balanceOf(account1.address);
      await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account3.address);
      const blockTimestamp1 = (await hre.ethers.provider.getBlock("latest")).timestamp;
      await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account3.address);
      const blockTimestamp2 = (await hre.ethers.provider.getBlock("latest")).timestamp;
      const depositTokenBalanceAfter = await depositToken.balanceOf(account1.address);
      const maxMultiplier = await timeLockPool.getMultiplier(MAX_LOCK_DURATION);

      const deposits = await timeLockPool.getDepositsOf(account3.address);
      const totalDeposit = await timeLockPool.getTotalDeposit(account3.address);
      const timeLockPoolBalance = await timeLockPool.balanceOf(account3.address);

      expect(deposits[0].amount).to.eq(DEPOSIT_AMOUNT);
      expect(deposits[0].start).to.eq(blockTimestamp1);
      expect(deposits[0].end).to.eq(BigNumber.from(blockTimestamp1).add(MAX_LOCK_DURATION));

      expect(deposits[1].amount).to.eq(DEPOSIT_AMOUNT);
      expect(deposits[1].start).to.eq(blockTimestamp2);
      expect(deposits[1].end).to.eq(BigNumber.from(blockTimestamp2).add(MAX_LOCK_DURATION));

      expect(deposits.length).to.eq(2);
      expect(totalDeposit).to.eq(DEPOSIT_AMOUNT.mul(2));
      expect(timeLockPoolBalance).to.eq(DEPOSIT_AMOUNT.mul(2).mul(maxMultiplier).div(constants.WeiPerEther));

      expect(depositTokenBalanceAfter).to.eq(depositTokenBalanceBefore.sub(DEPOSIT_AMOUNT.mul(2)));
    });
    it("Should fail when transfer fails", async () => {
      await depositToken.approve(timeLockPool.address, 0);
      await expect(timeLockPool.deposit(DEPOSIT_AMOUNT, 0, account3.address)).to.be.revertedWith(
        "ERC20: transfer amount exceeds allowance",
      );
    });
  });

  describe("withdraw", async () => {
    const DEPOSIT_AMOUNT = parseEther("176.378");

    beforeEach(async () => {
      await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account1.address);
    });

    it("Withdraw to zero address should fail", async () => {
      await expect(timeLockPool.withdraw(0, constants.AddressZero)).to.be.revertedWith("ZeroAddressError()");
    });

    it("Withdraw before expiry should fail", async () => {
      await expect(timeLockPool.withdraw(0, account1.address)).to.be.revertedWith("TooSoonError()");
    });

    it("Should work", async () => {
      await timeTraveler.increaseTime(MAX_LOCK_DURATION);
      await timeLockPool.withdraw(0, account3.address);

      const timeLockPoolBalance = await timeLockPool.balanceOf(account1.address);
      const totalDeposit = await timeLockPool.getTotalDeposit(account1.address);
      const depositTokenBalance = await depositToken.balanceOf(account3.address);

      expect(timeLockPoolBalance).to.eq(0);
      expect(totalDeposit).to.eq(0);
      expect(depositTokenBalance).to.eq(DEPOSIT_AMOUNT);
    });
  });

  describe("extendLock", async () => {
    const DEPOSIT_AMOUNT = parseEther("176.378");
    const THREE_MONTHS = MAX_LOCK_DURATION / 12;

    beforeEach(async () => {
      await timeLockPool.deposit(DEPOSIT_AMOUNT, THREE_MONTHS, account1.address);
    });

    it("Extending with zero duration should fail", async () => {
      await expect(timeLockPool.extendLock(0, 0)).to.be.revertedWith("ZeroDurationError()");
    });

    it("should not allow you to deposit past the endDate", async () => {
      const end = await timeLockPool.endDate();
      const minLockDuration = await timeLockPool.MIN_LOCK_DURATION();
      await timeTraveler.setNextBlockTimestamp(end - minLockDuration.mul(2));
      await timeTraveler.mine_blocks(1);
      await timeLockPool.deposit(1000, minLockDuration, account1.address);
      await timeLockPool.extendLock(1, MAX_LOCK_DURATION / 2);
      const deposit = await timeLockPool.depositsOf(account1.address, 1);
      expect(deposit.end).to.equal(end);
    });

    it("Extending when deposit has already expired should fail", async () => {
      await timeTraveler.increaseTime(MAX_LOCK_DURATION * 2);
      await expect(timeLockPool.extendLock(0, THREE_MONTHS)).to.be.revertedWith("DepositExpiredError()");
    });

    it("Extending should emit event with the correct arguments", async () => {
      await expect(timeLockPool.extendLock(0, THREE_MONTHS))
        .to.emit(timeLockPool, "LockExtended")
        .withArgs(0, THREE_MONTHS, account1.address);
    });

    it("Extending should change start and extend end time in the struct", async () => {
      const startUserDepostit = await timeLockPool.depositsOf(account1.address, 0);

      await timeLockPool.extendLock(0, THREE_MONTHS * 2);

      const endUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const latestBlockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
      // start of the deposit should be the block timestamp
      expect(endUserDepostit.start).to.be.eq(latestBlockTimestamp);
      // total length of the deposit should be the time left of the original deposit plus the time increased
      expect(endUserDepostit.end.sub(endUserDepostit.start)).to.be.eq(
        startUserDepostit.end.sub(latestBlockTimestamp).add(THREE_MONTHS * 2),
      );
    });

    it("Extending in between end and start should change start and extend end time in the struct", async () => {
      const startUserDepostit = await timeLockPool.depositsOf(account1.address, 0);

      const nextBlockTimestamp = startUserDepostit.end
        .sub(startUserDepostit.start)
        .div(2)
        .add(startUserDepostit.start)
        .toNumber();

      // Fastforward to half of the deposit time elapsed
      await timeTraveler.setNextBlockTimestamp(nextBlockTimestamp);

      await timeLockPool.extendLock(0, THREE_MONTHS * 2);

      const endUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const latestBlockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
      // start of the deposit should be the block timestamp
      expect(endUserDepostit.start).to.be.eq(latestBlockTimestamp);
      // total length of the deposit should be the time left of the original deposit plus the time increased
      expect(endUserDepostit.end.sub(endUserDepostit.start)).to.be.eq(
        startUserDepostit.end.sub(latestBlockTimestamp).add(THREE_MONTHS * 2),
      );
    });

    it("Extending should mint correct amount of tokens and change shareAmount in the struct", async () => {
      const startUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const startBalance = await timeLockPool.balanceOf(account1.address);

      await timeLockPool.extendLock(0, THREE_MONTHS * 2);

      const endUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const endBalance = await timeLockPool.balanceOf(account1.address);

      expect(startBalance).to.be.eq(startUserDepostit.shareAmount);
      expect(endBalance).to.be.eq(endUserDepostit.shareAmount);

      const latestBlockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
      // New multiplier comes from the curve by inputing the new duration of the lock
      const sixMonthsMultiplier = await timeLockPool.getMultiplier(
        startUserDepostit.end.sub(latestBlockTimestamp).add(THREE_MONTHS * 2),
      );
      // New share amount is the deposit amount times the new multiplier.
      const theoreticalEndShareAmount = DEPOSIT_AMOUNT.mul(sixMonthsMultiplier).div(parseEther("1"));

      expect(theoreticalEndShareAmount).to.be.eq(endUserDepostit.shareAmount).to.be.eq(endBalance);
    });

    it("Extending in between end and start should mint correct amount of tokens and change shareAmount in the struct", async () => {
      const startUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const startBalance = await timeLockPool.balanceOf(account1.address);

      const nextBlockTimestamp = startUserDepostit.end
        .sub(startUserDepostit.start)
        .div(2)
        .add(startUserDepostit.start)
        .toNumber();

      // Fastforward to half of the deposit time elapsed
      await timeTraveler.setNextBlockTimestamp(nextBlockTimestamp);

      await timeLockPool.extendLock(0, THREE_MONTHS * 2);

      const endUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const endBalance = await timeLockPool.balanceOf(account1.address);

      expect(startBalance).to.be.eq(startUserDepostit.shareAmount);
      expect(endBalance).to.be.eq(endUserDepostit.shareAmount);

      const latestBlockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
      // New multiplier comes from the curve by inputing the new duration of the lock
      const sixMonthsMultiplier = await timeLockPool.getMultiplier(
        startUserDepostit.end.sub(latestBlockTimestamp).add(THREE_MONTHS * 2),
      );
      // New share amount is the deposit amount times the new multiplier.
      const theoreticalEndShareAmount = DEPOSIT_AMOUNT.mul(sixMonthsMultiplier).div(parseEther("1"));

      expect(theoreticalEndShareAmount).to.be.eq(endUserDepostit.shareAmount).to.be.eq(endBalance);
    });
  });

  describe("increaseLock", async () => {
    const DEPOSIT_AMOUNT = parseEther("176.378");
    const INCREASE_AMOUNT = parseEther("50");

    beforeEach(async () => {
      await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account1.address);
    });

    it("Increasing with zero amount should fail", async () => {
      await expect(timeLockPool.increaseLock(0, account1.address, 0)).to.be.revertedWith("ZeroAmountError()");
    });

    it("Increasing when deposit has already expired should fail", async () => {
      await timeTraveler.increaseTime(MAX_LOCK_DURATION * 2);
      await expect(timeLockPool.increaseLock(0, account1.address, INCREASE_AMOUNT)).to.be.revertedWith(
        "DepositExpiredError()",
      );
    });

    it("Increasing should emit event with the correct arguments", async () => {
      await expect(timeLockPool.increaseLock(0, account1.address, INCREASE_AMOUNT))
        .to.emit(timeLockPool, "LockIncreased")
        .withArgs(0, account1.address, account1.address, INCREASE_AMOUNT);
    });

    it("Increasing should mint correct amount of tokens and change shareAmount in the struct", async () => {
      const startUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const startBalance = await timeLockPool.balanceOf(account1.address);

      await timeLockPool.increaseLock(0, account1.address, INCREASE_AMOUNT);

      const increaseTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;

      const endUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const endBalance = await timeLockPool.balanceOf(account1.address);

      expect(startBalance).to.be.eq(startUserDepostit.shareAmount);
      expect(endBalance).to.be.eq(endUserDepostit.shareAmount);

      // New multiplier comes from time from the timestamp when increased and the end of the lock
      const multiplier = await timeLockPool.getMultiplier(startUserDepostit.end.sub(increaseTimestamp));

      // Should increased the deposited amount times the multiplier
      const theoreticalIncrease = INCREASE_AMOUNT.mul(multiplier).div(parseEther("1"));
      expect(theoreticalIncrease.add(startUserDepostit.shareAmount))
        .to.be.eq(endUserDepostit.shareAmount)
        .to.be.eq(endBalance);
    });

    it("Increasing in between start and end of deposit should do it correctly", async () => {
      const startUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const startBalance = await timeLockPool.balanceOf(account1.address);

      const nextBlockTimestamp = startUserDepostit.end
        .sub(startUserDepostit.start)
        .div(2)
        .add(startUserDepostit.start)
        .toNumber();

      await timeTraveler.setNextBlockTimestamp(nextBlockTimestamp);

      await timeLockPool.increaseLock(0, account1.address, INCREASE_AMOUNT);
      const latestBlockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;

      const endUserDepostit = await timeLockPool.depositsOf(account1.address, 0);
      const endBalance = await timeLockPool.balanceOf(account1.address);

      expect(startBalance).to.be.eq(startUserDepostit.shareAmount);
      expect(endBalance).to.be.eq(endUserDepostit.shareAmount);

      // New multiplier comes from time from the timestamp when increased and the end of the lock
      const multiplier = await timeLockPool.getMultiplier(startUserDepostit.end.sub(latestBlockTimestamp));

      // Should increased the deposited amount times the multiplier
      const theoreticalIncrease = INCREASE_AMOUNT.mul(multiplier).div(parseEther("1"));
      expect(theoreticalIncrease.add(startUserDepostit.shareAmount))
        .to.be.eq(endUserDepostit.shareAmount)
        .to.be.eq(endBalance);
    });
  });

  describe("Batchable", async () => {
    it("User should make multiple deposits on the same transaction", async () => {
      const DEPOSIT_AMOUNT = parseEther("10");
      const calldatas: any[] = [];

      calldatas.push(
        (await timeLockPool.populateTransaction.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account1.address)).data,
      );

      calldatas.push(
        (await timeLockPool.populateTransaction.deposit(DEPOSIT_AMOUNT.mul(2), constants.MaxUint256, account1.address))
          .data,
      );

      calldatas.push(
        (await timeLockPool.populateTransaction.deposit(DEPOSIT_AMOUNT.mul(3), constants.MaxUint256, account1.address))
          .data,
      );

      const depositTokenBalanceBefore = await depositToken.balanceOf(account1.address);

      await timeLockPool.batch(calldatas, true);
      const blockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;

      const depositTokenBalanceAfter = await depositToken.balanceOf(account1.address);

      const deposits = await timeLockPool.getDepositsOf(account1.address);
      const totalDeposit = await timeLockPool.getTotalDeposit(account1.address);
      const timeLockPoolBalance = await timeLockPool.balanceOf(account1.address);
      const multiplier = await timeLockPool.getMultiplier(MAX_LOCK_DURATION);

      expect(deposits[0].amount).to.eq(DEPOSIT_AMOUNT);
      expect(deposits[0].start).to.eq(blockTimestamp);
      expect(deposits[0].end).to.eq(BigNumber.from(blockTimestamp).add(MAX_LOCK_DURATION));

      expect(deposits[1].amount).to.eq(DEPOSIT_AMOUNT.mul(2));
      expect(deposits[1].start).to.eq(blockTimestamp);
      expect(deposits[1].end).to.eq(BigNumber.from(blockTimestamp).add(MAX_LOCK_DURATION));

      expect(deposits[2].amount).to.eq(DEPOSIT_AMOUNT.mul(3));
      expect(deposits[2].start).to.eq(blockTimestamp);
      expect(deposits[2].end).to.eq(BigNumber.from(blockTimestamp).add(MAX_LOCK_DURATION));

      expect(deposits.length).to.eq(3);
      expect(totalDeposit).to.eq(DEPOSIT_AMOUNT.mul(6));
      expect(timeLockPoolBalance).to.eq(DEPOSIT_AMOUNT.mul(6).mul(multiplier).div(constants.WeiPerEther));

      expect(depositTokenBalanceAfter).to.eq(depositTokenBalanceBefore.sub(DEPOSIT_AMOUNT.mul(6)));
    });

    it("User should be able to withdraw and deposit in the same transaction", async () => {
      const DEPOSIT_AMOUNT = parseEther("10");
      const multiplier = await timeLockPool.getMultiplier(MAX_LOCK_DURATION);
      await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account1.address);
      const startingDepositBalance = await timeLockPool.balanceOf(account1.address);
      const blockTimestamp1 = (await hre.ethers.provider.getBlock("latest")).timestamp;
      const deposit = await timeLockPool.getDepositsOf(account1.address);
      expect(startingDepositBalance).to.be.eq(DEPOSIT_AMOUNT.mul(multiplier).div(constants.WeiPerEther));

      expect(deposit[0].amount).to.eq(DEPOSIT_AMOUNT);
      expect(deposit[0].start).to.eq(blockTimestamp1);
      expect(deposit[0].end).to.eq(BigNumber.from(blockTimestamp1).add(MAX_LOCK_DURATION));

      await timeTraveler.increaseTime(MAX_LOCK_DURATION);

      const calldatas: any[] = [];

      calldatas.push((await timeLockPool.populateTransaction.withdraw(0, account1.address)).data);

      calldatas.push(
        (await timeLockPool.populateTransaction.deposit(DEPOSIT_AMOUNT.div(2), constants.MaxUint256, account1.address))
          .data,
      );

      calldatas.push(
        (await timeLockPool.populateTransaction.deposit(DEPOSIT_AMOUNT.div(4), MAX_LOCK_DURATION / 2, account1.address))
          .data,
      );

      const depositTokenBalanceBefore = await depositToken.balanceOf(account1.address);

      await timeLockPool.batch(calldatas, true);
      const blockTimestamp2 = (await hre.ethers.provider.getBlock("latest")).timestamp;

      const depositTokenBalanceAfter = await depositToken.balanceOf(account1.address);

      const deposits = await timeLockPool.getDepositsOf(account1.address);
      const totalDeposit = await timeLockPool.getTotalDeposit(account1.address);
      const timeLockPoolBalance = await timeLockPool.balanceOf(account1.address);
      const multiplier1 = await timeLockPool.getMultiplier(MAX_LOCK_DURATION);
      const multiplier2 = await timeLockPool.getMultiplier(MAX_LOCK_DURATION / 2);

      expect(deposits[0].amount).to.eq(DEPOSIT_AMOUNT.div(2));
      expect(deposits[0].start).to.eq(blockTimestamp2);
      expect(deposits[0].end).to.eq(BigNumber.from(blockTimestamp2).add(MAX_LOCK_DURATION));

      expect(deposits[1].amount).to.eq(DEPOSIT_AMOUNT.div(4));
      expect(deposits[1].start).to.eq(blockTimestamp2);
      expect(deposits[1].end).to.eq(BigNumber.from(blockTimestamp2).add(MAX_LOCK_DURATION / 2));

      expect(deposits.length).to.eq(2);
      expect(totalDeposit).to.eq(DEPOSIT_AMOUNT.mul(3).div(4));
      expect(timeLockPoolBalance).to.eq(
        DEPOSIT_AMOUNT.div(2)
          .mul(multiplier1)
          .div(constants.WeiPerEther)
          .add(DEPOSIT_AMOUNT.div(4).mul(multiplier2).div(constants.WeiPerEther)),
      );

      expect(depositTokenBalanceAfter).to.eq(
        depositTokenBalanceBefore.sub(DEPOSIT_AMOUNT.div(4).mul(3)).add(DEPOSIT_AMOUNT),
      );
    });

    it("User should be able to increase and extend lock in the same transaction", async () => {
      const startTokenBalance = await depositToken.balanceOf(account1.address);
      const DEPOSIT_AMOUNT = parseEther("10");
      const INCREASE_AMOUNT = DEPOSIT_AMOUNT.div(2);
      await timeLockPool.deposit(DEPOSIT_AMOUNT, MAX_LOCK_DURATION / 4, account1.address);

      const startingDeposit = await timeLockPool.getDepositsOf(account1.address);

      const calldatas: any[] = [];

      calldatas.push((await timeLockPool.populateTransaction.increaseLock(0, account1.address, INCREASE_AMOUNT)).data);

      calldatas.push((await timeLockPool.populateTransaction.extendLock(0, MAX_LOCK_DURATION / 2)).data);

      await timeTraveler.increaseTime(MAX_LOCK_DURATION / 12);

      await timeLockPool.batch(calldatas, true);
      const blockTimestamp2 = (await hre.ethers.provider.getBlock("latest")).timestamp;
      const deposits = await timeLockPool.getDepositsOf(account1.address);
      const totalDeposit = await timeLockPool.getTotalDeposit(account1.address);
      const balance = await timeLockPool.balanceOf(account1.address);
      const endTokenBalance = await depositToken.balanceOf(account1.address);

      expect(deposits[0].start).to.be.eq(blockTimestamp2);
      expect(deposits[0].end.sub(deposits[0].start)).to.be.eq(
        startingDeposit[0].end.sub(blockTimestamp2).add(MAX_LOCK_DURATION / 2),
      );

      const multiplier = await timeLockPool.getMultiplier(deposits[0].end.sub(deposits[0].start));
      expect(balance).to.be.eq(DEPOSIT_AMOUNT.add(INCREASE_AMOUNT).mul(multiplier).div(constants.WeiPerEther));
      expect(totalDeposit).to.be.eq(startTokenBalance.sub(endTokenBalance));
    });
  });

  describe("View", async () => {
    it("Should retrieve correct information from a user from one pool", async () => {
      const viewFactory = new View__factory(deployer);
      let view: View;
      view = await viewFactory.deploy();

      const DEPOSIT_AMOUNT = parseEther("10");

      await timeLockPool.deposit(DEPOSIT_AMOUNT, 0, account3.address);
      await timeLockPool.deposit(DEPOSIT_AMOUNT.mul(2), 0, account3.address);
      const deposit0 = await timeLockPool.depositsOf(account3.address, 0);
      const deposit1 = await timeLockPool.depositsOf(account3.address, 1);

      const viewData = await view.fetchData(account3.address, [timeLockPool.address]);

      expect(viewData[0].poolAddress).to.be.eq(timeLockPool.address);

      expect(viewData[0].deposits[0].amount.toString()).to.be.eq(deposit0.amount.toString());
      expect(viewData[0].deposits[0].shareAmount.toString()).to.be.eq(deposit0.shareAmount.toString());
      expect(viewData[0].deposits[0].start.toString()).to.be.eq(deposit0.start.toString());
      expect(viewData[0].deposits[0].end.toString()).to.be.eq(deposit0.end.toString());

      expect(viewData[0].deposits[1].amount.toString()).to.be.eq(deposit1.amount.toString());
      expect(viewData[0].deposits[1].shareAmount.toString()).to.be.eq(deposit1.shareAmount.toString());
      expect(viewData[0].deposits[1].start.toString()).to.be.eq(deposit1.start.toString());
      expect(viewData[0].deposits[1].end.toString()).to.be.eq(deposit1.end.toString());
    });
  });

  describe("Kick", async () => {
    const DEPOSIT_AMOUNT = parseEther("176.378");
    const THREE_MONTHS = MAX_LOCK_DURATION / 12;

    beforeEach(async () => {
      await timeLockPool.deposit(DEPOSIT_AMOUNT, THREE_MONTHS, account1.address);
    });

    it("Trying to kick a non existing deposit should revert", async () => {
      await expect(timeLockPool.kick(1, account1.address)).to.be.revertedWith("NonExistingDepositError()");
    });

    it("Trying to kick before deposit ends should revert", async () => {
      await expect(timeLockPool.kick(0, account1.address)).to.be.revertedWith("TooSoonError()");
    });

    it("Trying to kick after end should succeed", async () => {
      await timeTraveler.increaseTime(THREE_MONTHS * 2);
      const balanceBeforeKick = await timeLockPool.balanceOf(account1.address);
      const depositBeforeKick = await timeLockPool.depositsOf(account1.address, 0);
      await timeLockPool.kick(0, account1.address);
      const balanceAfterKick = await timeLockPool.balanceOf(account1.address);
      const depositAfterKick = await timeLockPool.depositsOf(account1.address, 0);

      expect(balanceBeforeKick).to.be.eq(depositBeforeKick.shareAmount);
      expect(balanceAfterKick)
        .to.be.eq(depositAfterKick.shareAmount)
        .to.be.eq(depositBeforeKick.amount)
        .to.be.eq(depositAfterKick.amount);
    });
  });
});
