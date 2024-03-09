// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../interfaces/IUniswapRouter.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IMasterWombatV2.sol";
import "./StratManager.sol";
import "./FeeManager.sol";
import "../interfaces/IZaynReferrerV2.sol";
import "../interfaces/IWombexInterfaces.sol";
import "../interfaces/IZaynStrategyV2.sol";
import "../interfaces/IWombatRouter.sol";

contract StrategyV2Mock is StratManager, FeeManager, IZaynStrategyV2 {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Tokens used
    address public want;
    address public override wantUnderlyingToken;

    // Third party contracts
    // IConvexBooster public booster = IConvexBooster(0x0A251FA652B59592E60f4bfBce3cD9Cb3d3bd5E9);
    // IPool public wombatPool;
    // address public rewardPool; // convex base reward pool
    uint256 public poolId;

    struct RewardV2 {
        address token;
        address router; // uniswap v2 router
        address[] toWantUnderlyingRoute; // uniswap route
        uint minAmount; // minimum amount to be swapped to native
    }
    RewardV2[] public rewards;

    // Zayn settings
    uint256 public lastFeeCharge;
    bool public revShareEnabled = false;
    IZaynReferrerV2 public zaynReferrer;
    IWombatRouter public WOMBAT_ROUTER;
    address public WETH;
    // events
    event Deposit(uint256 tvl);
    event Withdraw(uint256 tvl);
    event AddedLiquidity(uint256 amount);
    event ChargedFees(uint256 revShareFees, uint256 zaynFees);
    event ManagementFees(uint256 zaynFees);
    event StratHarvest(address indexed harvester);
    event Migrated();

    constructor(
        address _want,
        address _wantUnderlyingToken,
        // IPool _wombatPool,
        uint256 _poolId,
        address _vault,
        address _unirouter,
        address _manager,
        address _strategist,
        address _zaynFeeRecipient,
        IWombatRouter _wombatRouter,
        address _weth
    ) StratManager(_manager, _strategist, _unirouter, _vault, _zaynFeeRecipient) {
        want = _want;
        wantUnderlyingToken = _wantUnderlyingToken;
        // wombatPool = _wombatPool;
        poolId = _poolId;
        lastFeeCharge = block.timestamp;
        WOMBAT_ROUTER = _wombatRouter;
        WETH = _weth;
        // Wombex
        // (,,,rewardPool,) = booster.poolInfo(poolId);
        // _giveAllowances();
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));
        if (wantBal > 0) {
            // booster.deposit(poolId, wantBal, true);
            emit Deposit(wantBal);
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            // IConvexRewardPool(rewardPool).withdrawAndUnwrap(_amount - wantBal, false);
            wantBal = IERC20(want).balanceOf(address(this));
        }

        if (wantBal > _amount) {
            wantBal = _amount;
        }

        IERC20(want).safeTransfer(vault, wantBal);
        emit Withdraw(wantBal);
    }

    // compounds earnings and charges performance fee
    function harvest() external whenNotPaused {
        // IConvexRewardPool(rewardPool).getReward(); // harvest
        // swapRewardsToUnderlying();

        uint256 swapped = IERC20(wantUnderlyingToken).balanceOf(address(this));
        if (swapped > 0) {
            // chargeFees(swapped);
            // addLiquidity();
            // deposit();
        }

        emit StratHarvest(msg.sender);
    }

    function swapRewardsToUnderlying() internal view {
        for (uint i; i < rewards.length; ++i) {
            // uint bal = IERC20(rewards[i].token).balanceOf(address(this));
            // if (bal >= rewards[i].minAmount) {
            //     uint256[] memory amountOuts = IUniswapRouter(rewards[i].router).getAmountsOut(bal, rewards[i].toWantUnderlyingRoute);
            //     uint256 _outputAmount = amountOuts[amountOuts.length - 1];
            //     uint256 _slippage = _outputAmount.mul(5 * 10 ** 15).div((1e18));
            //     uint256 _outputAmountAfterSlippage =  _outputAmount.sub(_slippage);
            //     IUniswapRouter(rewards[i].router).swapExactTokensForTokens(
            //         bal,
            //         _outputAmountAfterSlippage,
            //         rewards[i].toWantUnderlyingRoute,
            //         address(this),
            //         block.timestamp
            //     );
            // }
        }
    }

    function swapEthToUnderlying(
        address _token,
        address _underlyingToken,
        uint256 _amount
    ) internal returns (uint256 swappedAmount) {
        // address[] memory _path = new address[](2);
        // _path[0] = address(_token);
        // _path[1] = address(_underlyingToken);
        // address[] memory _poolPathArr = new address[](1);
        // _poolPathArr[0] = address(poolPath);
        // (uint256 minDepositOut,) = getAmountOut(_path, _poolPathArr, int256(_amount));
        // uint256 _before = IERC20(_underlyingToken).balanceOf(address(this));
        // WOMBAT_ROUTER.swapExactTokensForTokens(
        //     _path,
        //     _poolPathArr,
        //     _amount,
        //     minDepositOut,
        //     address(this),
        //     block.timestamp
        // );
        // uint256 _after = IERC20(_underlyingToken).balanceOf(address(this));
    }

    // performance fees
    function chargeFees(uint256 swapped) internal {
        uint256 zaynFee = swapped.mul(zaynFee).div(FEE_DIVISOR);
        if (revShareEnabled) {
            uint256 revShareFees = zaynFee.mul(revShareFees).div(FEE_DIVISOR);
            zaynReferrer.recordFeeShare(revShareFees);
            IERC20(wantUnderlyingToken).safeTransfer(address(zaynReferrer), revShareFees);
            IERC20(wantUnderlyingToken).safeTransfer(zaynFeeRecipient, zaynFee.sub(revShareFees));
            emit ChargedFees(revShareFees, zaynFee.sub(revShareFees));
        } else {
            IERC20(wantUnderlyingToken).safeTransfer(zaynFeeRecipient, zaynFee);
            emit ChargedFees(0, zaynFee);
        }
    }

    // Adds liquidity to AMM and gets more LP tokens.
    function addLiquidity() internal view {
        // uint256 underlyingAmount = IERC20(wantUnderlyingToken).balanceOf(address(this));
        // (uint256 minLiq,) = wombatPool.quotePotentialDeposit(wantUnderlyingToken, underlyingAmount);
        // (uint256 liquidity) = wombatPool.deposit(wantUnderlyingToken, underlyingAmount, 0, address(this), block.timestamp, false);
        // emit AddedLiquidity(liquidity);
    }

    // calculate the total underlaying 'want' held by the strat.
    function balanceOf() public view returns (uint256) {
        return balanceOfWant().add(balanceOfPool());
    }

    // it calculates how much 'want' this contract holds.
    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    // it calculates how much 'want' the strategy has working in the farm.
    function balanceOfPool() public pure returns (uint256) {
        return 0;
        // return IConvexRewardPool(rewardPool).balanceOf(address(this));
    }

    function revShareToken() public view override returns (address) {
        return wantUnderlyingToken;
    }

    // called as part of strat migration. Sends all the available funds back to the vault.
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        // IConvexRewardPool(rewardPool).withdrawAllAndUnwrap(false);

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).safeTransfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems.
    function panic() public onlyManager {
        pause();
        // IConvexRewardPool(rewardPool).withdrawAllAndUnwrap(false);
    }

    function pause() public onlyManager {
        _pause();

        _removeAllowances();
    }

    function unpause() external onlyManager {
        _unpause();

        _giveAllowances();

        deposit();
    }

    function _giveAllowances() internal {
        // IERC20(want).safeApprove(address(booster), type(uint256).max);
        // IERC20(wantUnderlyingToken).safeApprove(address(wombatPool), type(uint256).max);
    }

    function _removeAllowances() internal {
        // IERC20(want).safeApprove(address(booster), 0);
        // IERC20(wantUnderlyingToken).safeApprove(address(wombatPool), 0);
    }

    // charges 2% annual management fee per 12 hours.
    function chargeManagementFees() external {
        if (block.timestamp >= lastFeeCharge.add(mgmtFeeDelay)) {
            uint secondsElapsed = block.timestamp - lastFeeCharge;
            uint chargeAmount = chargePerDay.div(86400).mul(secondsElapsed); // getting 0.02 / 365 / 86400

            uint256 tvl = balanceOf();
            uint256 fees = tvl.mul(chargeAmount).div(1e18);

            // IConvexRewardPool(rewardPool).withdrawAndUnwrap(fees, false);
            IERC20(want).safeTransfer(zaynFeeRecipient, fees);
            lastFeeCharge = block.timestamp;
            emit ManagementFees(fees);
        }
    }

    function enableRevShare(IZaynReferrerV2 _referrer) external onlyOwner {
        revShareEnabled = true;
        zaynReferrer = _referrer;
    }

    function disableRevShare() external onlyOwner {
        revShareEnabled = false;
    }

    function migrate() external virtual override {
        require(msg.sender == vault, "!vault");
        emit Migrated();
    }

    function addRewardV2(
        address _router,
        address[] calldata _rewardToUnderlyingRoute,
        uint _minAmount
    ) external onlyOwner {
        // address token = _rewardToUnderlyingRoute[0];
        // require(token != want, "!want");
        // require(_rewardToUnderlyingRoute[_rewardToUnderlyingRoute.length - 1] == wantUnderlyingToken, "!want");
        // rewards.push(RewardV2(token, _router, _rewardToUnderlyingRoute, _minAmount));
        // IERC20(token).safeApprove(_router, 0);
        // IERC20(token).safeApprove(_router, type(uint).max);
        // IERC20(WETH).safeApprove(address(WOMBAT_ROUTER), 0);
        // IERC20(WETH).safeApprove(address(WOMBAT_ROUTER), type(uint).max);
    }

    function resetRewardsV2() external onlyManager {
        delete rewards;
    }

    function updateBooster(address _booster) external onlyOwner {
        // booster = IConvexBooster(_booster);
    }
}
