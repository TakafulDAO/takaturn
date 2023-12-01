// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IZaynZapV2TakaDAO} from "../interfaces/IZaynZapV2TakaDAO.sol";
import {IZaynVaultV2TakaDao} from "../interfaces/IZaynVaultV2TakaDao.sol";

import {LibYieldGenerationStorage} from "../libraries/LibYieldGenerationStorage.sol";

library LibYieldGeneration {
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

        uint neededShares = _ethToShares(_collateralAmount, yield);

        yield.withdrawnCollateral[_user] += _collateralAmount;
        yield.currentTotalDeposit -= _collateralAmount;

        address zapAddress = yield.providerAddresses["ZaynZap"];
        address vaultAddress = yield.providerAddresses["ZaynVault"];

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
    /// @param _yield The yield generation struct
    function _ethToShares(
        uint _collateralAmount,
        LibYieldGenerationStorage.YieldGeneration storage _yield
    ) internal view returns (uint) {
        uint pricePerShare = IZaynVaultV2TakaDao(_yield.providerAddresses["ZaynVault"])
            .getPricePerFullShare();

        return ((_collateralAmount * 10 ** 18) / pricePerShare);
    }
}
