// @ts-ignore
import hre, { ethers } from "hardhat";
import { TimeLockNonTransferablePoolV3__factory } from "../../typechain";

const proxyStakingContract = "0xc014286360Ef45aB15A6D3f6Bb1E54a03352aC8f";
// sPERC: 0xf64F48A4E27bBC299273532B26c83662ef776b7e

// TODO grab this from hodler analysis
const depositors: string[] = [];

async function main() {
  const depositsWithIds = [];
  const signer = (await ethers.getSigners())[0];
  const newImpl = new TimeLockNonTransferablePoolV3__factory(signer).attach(proxyStakingContract);
  for (let d of depositors) {
    const deposits = await newImpl.getDepositsOf(d);
    depositsWithIds.push({ address: d, count: deposits.length });
  }
  for (let di of depositsWithIds) {
    const { address, count } = di;
    for (let i = 0; i < count; i++) {
      await newImpl.refund(i, address);
      console.log(`Refunded ${address}, id: ${i}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
