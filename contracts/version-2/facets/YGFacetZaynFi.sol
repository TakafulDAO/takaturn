// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";
import {IZaynZapV2TakaDAO} from "../interfaces/IZaynZapV2TakaDAO.sol";

import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";

contract YGFacetZaynFi is IYGFacetZaynFi {
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

    function userAPR(uint termId, address user) external view returns (uint256) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        uint256 elaspedTime = block.timestamp - yield.startTimeStamp;

        return
            (userYieldGenerated(termId, user) / yield.currentTotalDeposit) /
            (elaspedTime * 365 days);
    }

    function termAPR(uint termId) external view returns (uint256) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        uint256 elaspedTime = block.timestamp - yield.startTimeStamp;

        return (totalYieldGenerated(termId) / yield.currentTotalDeposit) / (elaspedTime * 365 days);
    }

    function yieldDistributionRatio(uint termId, address user) external view returns (uint256) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[termId];

        return collateral.collateralMembersBank[user] / yield.currentTotalDeposit;
    }

    function totalYieldGenerated(uint termId) public view returns (uint) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        uint totalWithdrawnYield;

        address[] memory arrayToCheck = yield.yieldUsers;
        uint arrayLength = arrayToCheck.length;

        for (uint i; i < arrayLength; ) {
            totalWithdrawnYield += yield.withdrawnYield[arrayToCheck[i]];

            unchecked {
                ++i;
            }
        }

        return totalWithdrawnYield + (yield.totalDeposit - yield.currentTotalDeposit);
    }

    function userYieldGenerated(uint termId, address user) public view returns (uint) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        return yield.withdrawnYield[user] + (yield.totalDeposit - yield.currentTotalDeposit);
    }
}
