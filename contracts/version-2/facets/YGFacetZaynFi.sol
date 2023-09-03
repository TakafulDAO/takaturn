// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";
import {IZaynZapV2TakaDAO} from "../interfaces/IZaynZapV2TakaDAO.sol";
import {IZaynVaultV2TakaDao} from "../interfaces/IZaynVaultV2TakaDao.sol";

import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";
import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";

contract YGFacetZaynFi is IYGFacetZaynFi {
    event OnYGOptInToggled(uint indexed termId, address indexed participant, bool indexed optedIn); // Emits when a participant succesfully toggles yield generation

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @notice This function is used to deposit collateral for yield generation
    /// @param termId The term id for which the collateral is being deposited
    /// @param ethAmount The amount of collateral being deposited
    function depositYG(uint termId, uint ethAmount) external {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        yield.totalDeposit = ethAmount;
        yield.currentTotalDeposit = ethAmount;

        address vaultAddress = yield.providerAddresses["ZaynVault"];

        IZaynZapV2TakaDAO(yield.providerAddresses["ZaynZap"]).zapInEth{value: ethAmount}(vaultAddress, termId);

        yield.totalShares = IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId);
    }

    /// @notice This function is used to withdraw collateral from yield generation
    /// @param termId The term id for which the collateral is being withdrawn
    /// @param withdrawAmount The amount of collateral being withdrawn
    function withdrawYG(
        uint termId,
        uint256 withdrawAmount,
        address user
    ) external returns (uint neededShares) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        neededShares = (withdrawAmount * yield.totalShares) / yield.totalDeposit;

        yield.withdrawnCollateral[user] += withdrawAmount;
        yield.withdrawnYield[user] += neededShares;
        yield.currentTotalDeposit -= withdrawAmount;

        IZaynZapV2TakaDAO(yield.providerAddresses["ZaynZap"]).zapOutETH(yield.providerAddresses["ZaynVault"], neededShares, termId);
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

    function updateYieldProvider(string memory providerString, address providerAddress) external onlyOwner {
        LibYieldGeneration.YieldProviders storage yieldProvider = LibYieldGeneration
            ._yieldProviders();

        yieldProvider.providerAddresses[providerString] = providerAddress;
    }
}
