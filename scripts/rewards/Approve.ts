import { ethers } from "hardhat";
import { ERC20 } from "../../typechain";
const PERC = process.env.PERC as string;
const sPERC = process.env.SPERC as string;
const sLPPERC = process.env.SLPPERC as string;
const MAX_INT = "0xffffffffffffffffffffffffffffffffffffffff";

async function main() {
  const signers = await ethers.getSigners();
  const PercToken = await ethers.getContractFactory("ERC20");
  const percToken = PercToken.attach(PERC);
  const allowanceSPERC = await percToken.allowance(signers[0].address, sPERC);
  if (allowanceSPERC._hex !== MAX_INT) {
    await percToken.approve(sPERC, MAX_INT);
    console.log(`Approved ${sPERC}`);
  }
  const allowanceLP = await percToken.allowance(signers[0].address, sLPPERC);
  if (allowanceLP._hex !== MAX_INT) {
    await percToken.approve(sLPPERC, MAX_INT);
    console.log(`Approved ${sLPPERC}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
