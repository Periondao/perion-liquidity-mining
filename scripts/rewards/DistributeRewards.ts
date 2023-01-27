import { ethers } from 'hardhat'
import { parseEther } from "ethers/lib/utils";
const sPERC = process.env.SPERC as string;
const sLPPERC = process.env.SLPPERC as string;
const dailySPERCAllocation = parseEther("1357.4");
const dailyLPAllocation = parseEther("5429.6");

// Run the Approve script first
async function main() {
  const StakingContract = await ethers.getContractFactory('TimeLockNonTransferablePool');
  let stakingContract = StakingContract.attach(sPERC);
  await stakingContract.distributeRewards(dailySPERCAllocation);
  console.log(`distributed rewards to ${sPERC}`)
  stakingContract = stakingContract.attach(sLPPERC);
  await stakingContract.distributeRewards(dailyLPAllocation);
  console.log(`distributed rewards to ${sLPPERC}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
