// TODO fill vars
import { ethers } from 'hardhat'
const PERC = "0x60be1e1fe41c1370adaf5d8e66f07cf1c2df2268";
const sPERC = "";
const sLPPERC = "";
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
