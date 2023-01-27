import { ethers } from 'hardhat'
const PERC = process.env.PERC;
const sPERC = process.ENV.SPERC;
const sLPPERC = process.ENV.SLPPERC;
const MAX_INT = ethers.BigNumber.MAX_VALUE;

async function main() {
  const signers = await ethers.getSigners();
  const percToken = await ethers.getContractFactory('ERC20');
  percToken.attach(PERC);
  const allowanceSPERC = await percToken.allowance(signers[0], sPERC);
  if(allowanceSPERC !== MAX_INT) {
    await percToken.approve(sPERC, MAX_INT);
  }
  const allowanceLP = await percToken.allowance(signers[0], sLPPERC);
  if(allowanceLP !== MAX_INT) {
    await percToken.approve(sLPPERC, MAX_INT);
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
