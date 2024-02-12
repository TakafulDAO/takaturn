// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IZaynZapV2TakaDAO} from "../interfaces/IZaynZapV2TakaDAO.sol";
import {IZaynVaultV2TakaDao} from "../interfaces/IZaynVaultV2TakaDao.sol";

import {LibYieldGenerationStorage} from "../libraries/LibYieldGenerationStorage.sol";

library LibYieldGeneration {
    event OnYieldClaimed(
        uint indexed termId,
        address indexed user,
        address receiver,
        uint indexed amount
    ); // Emits when a user claims their yield

    /// @notice This function is used to deposit collateral for yield generation
    /// @param _termId The term id for which the collateral is being deposited
    /// @param _ethAmount The amount of collateral being deposited
    function _depositYG(uint _termId, uint _ethAmount) internal {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_termId];

        yield.totalDeposit = _ethAmount;
        yield.currentTotalDeposit = _ethAmount;

        address vaultAddress = yield.providerAddresses["ZaynVault"];

        IZaynZapV2TakaDAO(yield.providerAddresses["ZaynZap"]).zapInEth{value: _ethAmount}(
            vaultAddress,
            _termId
        );

        yield.totalShares = IZaynVaultV2TakaDao(vaultAddress).balanceOf(_termId);
    }

    /// @notice This function is used to withdraw collateral from the yield generation protocol
    /// @param _termId The term id for which the collateral is being withdrawn
    /// @param _collateralAmount The amount of collateral being withdrawn
    /// @param _user The user address that is withdrawing the collateral
    function _withdrawYG(
        uint _termId,
        uint256 _collateralAmount,
        address _user
    ) internal returns (uint) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_termId];

        uint neededShares;

        yield.withdrawnCollateral[_user] += _collateralAmount;
        yield.currentTotalDeposit -= _collateralAmount;

        address zapAddress = yield.providerAddresses["ZaynZap"];
        address vaultAddress = yield.providerAddresses["ZaynVault"];

        uint sharesBalance = IZaynVaultV2TakaDao(vaultAddress).balanceOf(_termId);

        // Prevent rounding errors
        if ((sharesBalance - neededShares) < 100) {
            neededShares = sharesBalance;
        } else {
            neededShares = _neededShares(_collateralAmount, yield.totalShares, yield.totalDeposit);
        }

        uint withdrawnAmount = IZaynZapV2TakaDAO(zapAddress).zapOutETH(
            vaultAddress,
            neededShares,
            _termId
        );

        if (withdrawnAmount < _collateralAmount) {
            return 0;
        } else {
            uint withdrawnYield = withdrawnAmount - _collateralAmount;
            yield.withdrawnYield[_user] += withdrawnYield;
            yield.availableYield[_user] += withdrawnYield;

            return withdrawnYield;
        }
    }

    /// @notice Conversion from shares to eth
    /// @param _termId The term id
    /// @param _yield The yield generation struct
    function _sharesToEth(
        uint _termId,
        LibYieldGenerationStorage.YieldGeneration storage _yield
    ) internal view returns (uint) {
        uint termBalance = IZaynVaultV2TakaDao(_yield.providerAddresses["ZaynVault"]).balanceOf(
            _termId
        );

        uint pricePerShare = IZaynVaultV2TakaDao(_yield.providerAddresses["ZaynVault"])
            .getPricePerFullShare();

        return (termBalance * pricePerShare) / 10 ** 18;
    }

    /// @notice Conversion from eth to shares
    /// @param _collateralAmount The amount of collateral to withdraw
    /// @param _totalShares The total shares in the yield from the term
    /// @param _totalDeposit The total deposit in the yield from the term
    function _neededShares(
        uint _collateralAmount,
        uint _totalShares,
        uint _totalDeposit
    ) internal pure returns (uint) {
        if (_totalDeposit == 0) return 0;
        return ((_collateralAmount * _totalShares) / _totalDeposit);
    }

    /// @notice This function is used to get the current total yield generated for a term
    /// @param _termId The term id for which the yield is being calculated
    /// @return The total yield generated for the term
    function _currentYieldGenerated(uint _termId) internal view returns (uint) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_termId];

        uint termBalance = IZaynVaultV2TakaDao(yield.providerAddresses["ZaynVault"]).balanceOf(
            _termId
        );
        uint pricePerShare = IZaynVaultV2TakaDao(yield.providerAddresses["ZaynVault"])
            .getPricePerFullShare();

        uint sharesInEth = (termBalance * pricePerShare) / 10 ** 18;
        if (sharesInEth > yield.currentTotalDeposit) {
            return sharesInEth - yield.currentTotalDeposit;
        } else {
            return 0;
        }
    }

    /// @notice This function is used to get the yield distribution ratio for a user
    /// @param _termId The term id for which the ratio is being calculated
    /// @param _user The user for which the ratio is being calculated
    /// @return The yield distribution ratio for the user
    function _yieldDistributionRatio(uint _termId, address _user) internal view returns (uint256) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_termId];

        if (yield.currentTotalDeposit == 0) {
            return 0;
        } else {
            return
                ((yield.depositedCollateralByUser[_user] - yield.withdrawnCollateral[_user]) *
                    10 ** 18) / yield.totalDeposit;
        }
    }

    /// @notice This function is used to get the total yield generated for a user
    /// @param termId The term id for which the yield is being calculated
    /// @param user The user for which the yield is being calculated
    /// @return The total yield generated for the user
    function _unwithdrawnUserYieldGenerated(
        uint termId,
        address user
    ) internal view returns (uint) {
        uint yieldDistributed = (_currentYieldGenerated(termId) *
            _yieldDistributionRatio(termId, user)) / 10 ** 18;

        return yieldDistributed;
    }

    function _claimAvailableYield(uint _termId, address _user, address _receiver) internal {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_termId];

        uint availableYield = yield.availableYield[_user];

        require(availableYield > 0, "No yield to withdraw");

        yield.availableYield[_user] = 0;
        (bool success, ) = payable(_receiver).call{value: availableYield}("");
        require(success);

        emit OnYieldClaimed(_termId, _user, _receiver, availableYield);
    }
}
