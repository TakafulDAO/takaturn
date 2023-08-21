// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";
import {IZaynZapV2TakaDAO} from "../interfaces/IZaynZapV2TakaDAO.sol";

import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";

contract YGFacetZaynFi is IYGFacetZaynFi {
    function depositYG(uint termId, uint amount) external {
        LibYieldGeneration.YieldGenerationConsts storage yieldGenerationConsts = LibYieldGeneration
            ._yieldGenerationConsts();
        LibYieldGeneration.YieldGeneration storage yieldGeneration = LibYieldGeneration
            ._yieldGeneration();

        yieldGeneration.totalDeposit = amount;
        yieldGeneration.currentTotalDeposit += amount;

        IZaynZapV2TakaDAO(yieldGenerationConsts.zapAddress).zapInEth{value: amount}(
            yieldGenerationConsts.vaultAddress,
            termId
        );
    }
}
