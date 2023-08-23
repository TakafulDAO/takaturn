// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";
import {IZaynZapV2TakaDAO} from "../interfaces/IZaynZapV2TakaDAO.sol";

import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";

contract YGFacetZaynFi is IYGFacetZaynFi {
    /// @notice This function is used to deposit collateral for yield generation
    /// @param termId The term id for which the collateral is being deposited
    /// @param ethAmount The amount of collateral being deposited
    function depositYG(uint termId, uint ethAmount) external {
        LibYieldGeneration.YieldGenerationConsts storage yieldGenerationConsts = LibYieldGeneration
            ._yieldGenerationConsts();
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        yield.totalDeposit = ethAmount;
        yield.currentTotalDeposit = ethAmount;

        IZaynZapV2TakaDAO(yieldGenerationConsts.zapAddress).zapInEth{value: ethAmount}(
            yieldGenerationConsts.vaultAddress,
            termId
        );
    }

    /// @notice This function is used to withdraw collateral from yield generation
    /// @param termId The term id for which the collateral is being withdrawn
    /// @param user The user who is withdrawing the collateral
    /// @param ethAmount The amount of collateral being withdrawn
    function withdrawYG(uint termId, address user, uint256 ethAmount) external {
        LibYieldGeneration.YieldGenerationConsts storage yieldGenerationConsts = LibYieldGeneration
            ._yieldGenerationConsts();
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        yield.currentTotalDeposit -= ethAmount;
        yield.withdrawnYield[user] += ethAmount;

        IZaynZapV2TakaDAO(yieldGenerationConsts.zapAddress).zapOutETH(
            yieldGenerationConsts.vaultAddress,
            ethAmount,
            termId
        );

        (bool success, ) = payable(user).call{value: ethAmount}("");
        require(success);
    }
}
