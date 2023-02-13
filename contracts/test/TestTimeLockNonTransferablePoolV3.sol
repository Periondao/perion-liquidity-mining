// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../TimeLockNonTransferablePoolV2.sol";

contract TimeLockNonTransferablePoolV3 is TimeLockNonTransferablePoolV2 {
    function testingUpgrade() public view returns (uint256) {
        return 7357;
    }
}
