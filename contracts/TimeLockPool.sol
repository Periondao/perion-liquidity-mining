// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import { IERC20Upgradeable as IERC20 } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { MathUpgradeable as Math } from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import { SafeERC20Upgradeable as SafeERC20 } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./base/BasePool.sol";
import "./interfaces/ITimeLockPool.sol";

contract TimeLockPool is BasePool, ITimeLockPool {
    using Math for uint256;
    using SafeERC20 for IERC20;

    error SmallMaxLockDuration();
    error NonExistingDepositError();
    error TooSoonError();
    error MaxBonusError();
    error ShareBurningError();

    uint256 public maxBonus;
    uint256 public maxLockDuration;
    uint256 public constant MIN_LOCK_DURATION = 30 days;

    uint256 public endDate;

    mapping(address => Deposit[]) public depositsOf;

    struct Deposit {
        uint256 amount;
        uint256 shareAmount;
        uint64 start;
        uint64 end;
    }

    function __TimeLockPool_init(
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
    ) internal onlyInitializing {
        __BasePool_init(_name, _symbol, _depositToken, _rewardToken, _escrowPool, _escrowPortion, _escrowDuration);
        if (_maxLockDuration < MIN_LOCK_DURATION) {
            revert SmallMaxLockDuration();
        }
        maxBonus = _maxBonus;
        if (block.timestamp > _endDate) {
            revert ProgramExpiredError();
        }
        endDate = _endDate;
        maxLockDuration = _maxLockDuration;
    }

    error DepositExpiredError();
    error ProgramExpiredError();
    error ZeroDurationError();
    error ZeroAddressError();
    error ZeroAmountError();

    event Deposited(uint256 amount, uint256 duration, address indexed receiver, address indexed from);
    event Withdrawn(uint256 indexed depositId, address indexed receiver, address indexed from, uint256 amount);
    event LockExtended(uint256 indexed depositId, uint256 duration, address indexed from);
    event LockIncreased(uint256 indexed depositId, address indexed receiver, address indexed from, uint256 amount);

    /**
     * @notice Creates a lock with an amount of tokens and mint the corresponding shares.
     * @dev The duration is has a lower and an upper bound which are enforced in case its
     * value is outside those bounds. Uses the multiplier function to get the amount of shares to mint.
     * @param _amount uint256 amount of tokens to be deposited
     * @param _duration uint256 time that the deposit will be locked.
     * @param _receiver address owner of the lock
     */
    function deposit(
        uint256 _amount,
        uint256 _duration,
        address _receiver
    ) external override {
        if (block.timestamp + MIN_LOCK_DURATION > endDate) {
            revert ProgramExpiredError();
        }
        if (_amount == 0) {
            revert ZeroAmountError();
        }
        // Don't allow locking > maxLockDuration
        uint256 duration = _duration.min(maxLockDuration);
        // Enforce min lockup duration to prevent flash loan or MEV transaction ordering
        duration = duration.max(MIN_LOCK_DURATION);
        if (duration + block.timestamp > endDate) {
            // only allow the user to deposit up to the endDate
            uint256 difference = (duration + block.timestamp) - endDate;
            duration -= difference;
        }

        uint256 mintAmount = (_amount * getMultiplier(duration)) / ONE;

        depositsOf[_receiver].push(
            Deposit({
                amount: _amount,
                shareAmount: mintAmount,
                start: uint64(block.timestamp),
                end: uint64(block.timestamp) + uint64(duration)
            })
        );

        _mint(_receiver, mintAmount);
        depositToken.safeTransferFrom(_msgSender(), address(this), _amount);
        emit Deposited(_amount, duration, _receiver, _msgSender());
    }

    /**
     * @notice Withdraws all the tokens from the lock
     * @dev The lock has to be expired to withdraw the tokens. When the withdrawal happens
     * the shares minted on the deposit are burnt.
     * @param _depositId uint256 id of the deposit to be withdrawn from.
     * @param _receiver address receiver of the withdrawn funds
     */
    function withdraw(uint256 _depositId, address _receiver) external {
        if (_receiver == address(0)) {
            revert ZeroAddressError();
        }
        if (_depositId >= depositsOf[_msgSender()].length) {
            revert NonExistingDepositError();
        }
        Deposit memory userDeposit = depositsOf[_msgSender()][_depositId];
        if (block.timestamp < userDeposit.end) {
            revert TooSoonError();
        }

        // remove Deposit
        depositsOf[_msgSender()][_depositId] = depositsOf[_msgSender()][depositsOf[_msgSender()].length - 1];
        depositsOf[_msgSender()].pop();

        // burn pool shares
        _burn(_msgSender(), userDeposit.shareAmount);

        // return tokens
        depositToken.safeTransfer(_receiver, userDeposit.amount);
        emit Withdrawn(_depositId, _receiver, _msgSender(), userDeposit.amount);
    }

    /**
     * @notice Adds more time to current lock.
     * @dev This function extends the duration of a specific lock -deposit- of the sender.
     * While doing so, it uses the timestamp of the current block and calculates the remaining
     * time to the end of the lock, and adds the increased duration. This results in a new
     * duration that can be different to the original duration from the lock one (>, = or <),
     * and gets multiplied by the corresponding multiplier. The final result can be more, same,
     * or less shares, which will be minted/burned accordingly.
     * @param _depositId uint256 id of the deposit to be increased.
     * @param _increaseDuration uint256 time to be added to the lock measured from the end of the lock
     */
    function extendLock(uint256 _depositId, uint256 _increaseDuration) external {
        // Check if actually increasing
        if (_increaseDuration == 0) {
            revert ZeroDurationError();
        }

        Deposit memory userDeposit = depositsOf[_msgSender()][_depositId];

        // Only can extend if it has not expired
        if (block.timestamp >= userDeposit.end) {
            revert DepositExpiredError();
        }

        // Enforce min increase to prevent flash loan or MEV transaction ordering
        uint256 increaseDuration = _increaseDuration.max(MIN_LOCK_DURATION);

        // New duration is the time expiration plus the increase
        uint256 duration = maxLockDuration.min(uint256(userDeposit.end - block.timestamp) + increaseDuration);
        if (duration + block.timestamp > endDate) {
            // only allow the user to deposit up to the endDate
            uint256 difference = (duration + block.timestamp) - endDate;
            duration -= difference;
        }

        uint256 mintAmount = (userDeposit.amount * getMultiplier(duration)) / ONE;

        // If the new amount if bigger mint the difference
        if (mintAmount >= userDeposit.shareAmount) {
            depositsOf[_msgSender()][_depositId].shareAmount = mintAmount;
            _mint(_msgSender(), mintAmount - userDeposit.shareAmount);
            // If the new amount is less then burn that difference
        } else {
            revert ShareBurningError();
        }

        depositsOf[_msgSender()][_depositId].start = uint64(block.timestamp);
        depositsOf[_msgSender()][_depositId].end = uint64(block.timestamp) + uint64(duration);
        emit LockExtended(_depositId, _increaseDuration, _msgSender());
    }

    /**
     * @notice Adds more deposits to current lock.
     * @dev This function increases the deposit amount of a specific lock -deposit- of the sender.
     * While doing so, it uses the timestamp of the current block and calculates the remaining
     * time to the end of the lock. Then it uses this time duration to mint the shares that correspond
     * to the multiplier of that time and the increase amount being deposited. The result is an increase
     * both in deposit amount and share amount of the deposit.
     * @param _depositId uint256 id of the deposit to be increased.
     * @param _receiver address owner of the lock
     * @param _increaseAmount uint256 amount of tokens to add to the lock.
     */
    function increaseLock(
        uint256 _depositId,
        address _receiver,
        uint256 _increaseAmount
    ) external {
        // Check if actually increasing
        if (_increaseAmount == 0) {
            revert ZeroAmountError();
        }

        Deposit memory userDeposit = depositsOf[_receiver][_depositId];

        // Only can extend if it has not expired
        if (block.timestamp >= userDeposit.end) {
            revert DepositExpiredError();
        }

        // Multiplier should be according the remaining time  from the deposit until its end.
        uint256 remainingDuration = uint256(userDeposit.end - block.timestamp);

        uint256 mintAmount = (_increaseAmount * getMultiplier(remainingDuration)) / ONE;

        depositsOf[_receiver][_depositId].amount += _increaseAmount;
        depositsOf[_receiver][_depositId].shareAmount += mintAmount;

        _mint(_receiver, mintAmount);
        depositToken.safeTransferFrom(_msgSender(), address(this), _increaseAmount);
        emit LockIncreased(_depositId, _receiver, _msgSender(), _increaseAmount);
    }

    function getMultiplier(uint256 _lockDuration) public view returns (uint256) {
        return 1e18 + ((maxBonus * _lockDuration) / maxLockDuration);
    }

    function getTotalDeposit(address _account) public view returns (uint256) {
        uint256 total;
        for (uint256 i = 0; i < depositsOf[_account].length; i++) {
            total += depositsOf[_account][i].amount;
        }

        return total;
    }

    function getDepositsOf(address _account) public view returns (Deposit[] memory) {
        return depositsOf[_account];
    }

    function getDepositsOfLength(address _account) public view returns (uint256) {
        return depositsOf[_account].length;
    }

    function maxBonusError(uint256 _point) internal returns (uint256) {
        if (_point > maxBonus) {
            revert MaxBonusError();
        } else {
            return _point;
        }
    }

    function kick(uint256 _depositId, address _user) external {
        if (_depositId >= depositsOf[_user].length) {
            revert NonExistingDepositError();
        }
        Deposit memory userDeposit = depositsOf[_user][_depositId];
        if (block.timestamp < userDeposit.end) {
            revert TooSoonError();
        }

        // burn pool shares so that resulting are equal to deposit amount
        _burn(_user, userDeposit.shareAmount - userDeposit.amount);
        depositsOf[_user][_depositId].shareAmount = userDeposit.amount;
    }
}
