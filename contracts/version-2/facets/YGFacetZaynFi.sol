// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";
import {IZaynZapV2TakaDAO} from "../interfaces/IZaynZapV2TakaDAO.sol";

import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";
import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";

import {TermOwnable} from "../../version-1/access/TermOwnable.sol";

contract YGFacetZaynFi is IYGFacetZaynFi, TermOwnable {
    event OnYGOptInToggled(uint indexed termId, address indexed participant, bool indexed optedIn); // Emits when a participant succesfully toggles yield generation

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @notice This function is used to deposit collateral for yield generation
    /// @param termId The term id for which the collateral is being deposited
    /// @param ethAmount The amount of collateral being deposited
    function depositYG(uint termId, uint ethAmount) external /*onlyTermOwner(termId)*/ {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        yield.totalDeposit = ethAmount;
        yield.currentTotalDeposit = ethAmount;

        IZaynZapV2TakaDAO(yield.zap).zapInEth{value: ethAmount}(yield.vault, termId);
    }

    /// @notice This function is used to withdraw collateral from yield generation
    /// @param termId The term id for which the collateral is being withdrawn
    /// @param user The user who is withdrawing the collateral
    /// @param ethAmount The amount of collateral being withdrawn
    function withdrawYG(
        uint termId,
        address user,
        uint256 ethAmount
    ) external /*onlyTermOwner(termId)*/ {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        yield.currentTotalDeposit -= ethAmount;
        yield.withdrawnYield[user] += ethAmount;

        IZaynZapV2TakaDAO(yield.zap).zapOutETH(yield.vault, ethAmount, termId);

        // (bool success, ) = payable(user).call{value: ethAmount}("");
        // require(success);
    }

    function toggleOptInYG(uint termId) external {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[termId];

        require(
            collateral.state == LibCollateralV2.CollateralStates.AcceptingCollateral,
            "Too late to change YG opt in"
        );
        require(collateral.isCollateralMember[msg.sender], "Not part of term");

        bool newDecision = !yield.hasOptedIn[msg.sender];

        yield.hasOptedIn[msg.sender] = newDecision;
        emit OnYGOptInToggled(termId, msg.sender, newDecision);
    }

    function addYieldProviders(address zap, address vault) external onlyOwner {
        LibYieldGeneration.YieldProviders storage yieldProvider = LibYieldGeneration
            ._yieldProviders();

        yieldProvider.zaps.push(zap);
        yieldProvider.vaults.push(vault);
    }
}
