// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../interfaces/IAbstractRewards.sol";
import { SafeCastUpgradeable as SafeCast } from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @dev Based on: https://github.com/indexed-finance/dividends/blob/master/contracts/base/AbstractDividends.sol
 * Renamed dividends to rewards.
 * @dev (OLD) Many functions in this contract were taken from this repository:
 * https://github.com/atpar/funds-distribution-token/blob/master/contracts/FundsDistributionToken.sol
 * which is an example implementation of ERC 2222, the draft for which can be found at
 * https://github.com/atpar/funds-distribution-token/blob/master/EIP-DRAFT.md
 *
 * This contract has been substantially modified from the original and does not comply with ERC 2222.
 * Many functions were renamed as "rewards" rather than "funds" and the core functionality was separated
 * into this abstract contract which can be inherited by anything tracking ownership of reward shares.
 */
abstract contract AbstractRewards is Initializable, IAbstractRewards {
    using SafeCast for uint128;
    using SafeCast for uint256;
    using SafeCast for int256;

    error ZeroShareSupplyError();

    /* ========  Constants  ======== */
    uint128 public constant POINTS_MULTIPLIER = type(uint128).max;

    /* ========  Internal Function References  ======== */
    function(address) view returns (uint256) private getSharesOf;
    function() view returns (uint256) private getTotalShares;

    /* ========  Storage  ======== */
    uint256 public pointsPerShare;
    mapping(address => int256) public pointsCorrection;
    mapping(address => uint256) public withdrawnRewards;

    function __AbstractRewards_init(
        function(address) view returns (uint256) getSharesOf_,
        function() view returns (uint256) getTotalShares_
    ) internal onlyInitializing {
        getSharesOf = getSharesOf_;
        getTotalShares = getTotalShares_;
    }

    /* ========  Public View Functions  ======== */
    /// @inheritdoc IAbstractRewards
    function withdrawableRewardsOf(address _account) public view override returns (uint256) {
        return cumulativeRewardsOf(_account) - withdrawnRewards[_account];
    }

    /// @inheritdoc IAbstractRewards
    function withdrawnRewardsOf(address _account) public view override returns (uint256) {
        return withdrawnRewards[_account];
    }

    /// @inheritdoc IAbstractRewards
    function cumulativeRewardsOf(address _account) public view override returns (uint256) {
        return
            ((pointsPerShare * getSharesOf(_account)).toInt256() + pointsCorrection[_account]).toUint256() /
            POINTS_MULTIPLIER;
    }

    /* ========  Dividend Utility Functions  ======== */

    /**
     * @notice Distributes rewards to token holders.
     * @dev It reverts if the total shares is 0.
     * It emits the `RewardsDistributed` event if the amount to distribute is greater than 0.
     * About undistributed rewards:
     *   In each distribution, there is a small amount which does not get distributed,
     *   which is `(amount * POINTS_MULTIPLIER) % totalShares()`.
     *   With a well-chosen `POINTS_MULTIPLIER`, the amount of funds that are not getting
     *   distributed in a distribution can be less than 1 (base unit).
     */
    function _distributeRewards(uint256 _amount) internal {
        uint256 shares = getTotalShares();
        if (shares == 0) {
            revert ZeroShareSupplyError();
        }

        if (_amount > 0) {
            pointsPerShare = pointsPerShare + ((_amount * POINTS_MULTIPLIER) / shares);
            emit RewardsDistributed(msg.sender, _amount);
        }
    }

    /**
     * @notice Prepares collection of owed rewards
     * @dev It emits a `RewardsWithdrawn` event if the amount of withdrawn rewards is
     * greater than 0.
     */
    function _prepareCollect(address _account) internal returns (uint256) {
        uint256 _withdrawableDividend = withdrawableRewardsOf(_account);
        if (_withdrawableDividend > 0) {
            withdrawnRewards[_account] = withdrawnRewards[_account] + _withdrawableDividend;
            emit RewardsWithdrawn(_account, _withdrawableDividend);
        }
        return _withdrawableDividend;
    }

    function _correctPointsForTransfer(
        address _from,
        address _to,
        uint256 _shares
    ) internal {
        int256 _magCorrection = (pointsPerShare * _shares).toInt256();
        pointsCorrection[_from] = pointsCorrection[_from] + _magCorrection;
        pointsCorrection[_to] = pointsCorrection[_to] - _magCorrection;
    }

    /**
     * @dev Increases or decreases the points correction for `account` by
     * `shares*pointsPerShare`.
     */
    function _correctPoints(address _account, int256 _shares) internal {
        pointsCorrection[_account] = pointsCorrection[_account] + (_shares * (int256(pointsPerShare)));
    }
}
