// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./TimeLockPoolV2.sol";

contract TimeLockNonTransferablePoolV2 is TimeLockPoolV2 {
    uint256[50] __gap; // Storage gap for reserving storage slots in future upgrades and preserve storage layout.

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        address _depositToken,
        address _rewardToken,
        address _escrowPool,
        uint256 _escrowPortion,
        uint256 _escrowDuration,
        uint256 _maxBonus,
        uint256 _maxLockDuration,
        uint256 _endDate
    ) public initializer {
        __TimeLockPool_init(
            _name,
            _symbol,
            _depositToken,
            _rewardToken,
            _escrowPool,
            _escrowPortion,
            _escrowDuration,
            _maxBonus,
            _maxLockDuration,
            _endDate
        );
    }

    // disable transfers
    function _transfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal override {
        revert("NON_TRANSFERABLE");
    }
}
