import { ethers } from 'hardhat'
import { parseEther } from "ethers/lib/utils";
const sPERC = process.ENV.SPERC;
const sLPPERC = process.ENV.SLPPERC;
const dailySPERCAllocation = parseEther("1357.4");
const dailyLPAllocation = parseEther("5429.6");

// Run the Approve script first
async function main() {
  const stakingContractBasePool = await ethers.getContractFactory('BasePool');
  stakingContractBasePool.attach(sPERC);
  await stakingContractBasePool.distributeRewards(dailySPERCAllocation);
  stakingContractBasePool.attach(sLPPERC);
  await stakingContractBasePool.distributeRewards(dailyLPAllocation);
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
