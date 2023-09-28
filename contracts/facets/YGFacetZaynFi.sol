// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";
import {IZaynZapV2TakaDAO} from "../interfaces/IZaynZapV2TakaDAO.sol";
import {IZaynVaultV2TakaDao} from "../interfaces/IZaynVaultV2TakaDao.sol";

import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";
import {LibFundStorage} from "../libraries/LibFundStorage.sol";

contract YGFacetZaynFi is IYGFacetZaynFi {
    event OnYGOptInToggled(uint indexed termId, address indexed user, bool indexed optedIn); // Emits when a user succesfully toggles yield generation
    event OnYieldClaimed(uint indexed termId, address indexed user, uint indexed amount); // Emits when a user claims their yield

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

        IZaynZapV2TakaDAO(yield.providerAddresses["ZaynZap"]).zapInEth{value: ethAmount}(
            vaultAddress,
            termId
        );

        yield.totalShares = IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId);
    }

    /// @notice This function is used to withdraw collateral from the yield generation protocol
    /// @param termId The term id for which the collateral is being withdrawn
    /// @param collateralAmount The amount of collateral being withdrawn
    function withdrawYG(
        uint termId,
        uint256 collateralAmount,
        address user
    ) external returns (uint) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        uint neededShares = (collateralAmount * yield.totalShares) / yield.totalDeposit;

        yield.withdrawnCollateral[user] += collateralAmount;
        yield.currentTotalDeposit -= collateralAmount;

        address zapAddress = yield.providerAddresses["ZaynZap"];
        address vaultAddress = yield.providerAddresses["ZaynVault"];

        uint withdrawnAmount = IZaynZapV2TakaDAO(zapAddress).zapOutETH(
            vaultAddress,
            neededShares,
            termId
        );

        uint withdrawnYield = withdrawnAmount - collateralAmount;
        yield.withdrawnYield[user] += withdrawnYield;
        yield.availableYield[user] += withdrawnYield;

        return withdrawnYield;
    }

    /// @notice This function allows a user to claim the current available yield
    /// @param termId The term id for which the yield is being claimed
    function claimAvailableYield(uint termId) external {
        _claimAvailableYield(termId, msg.sender);
    }

    /// @notice This function allows a user to claim the current available yield
    /// @param termId The term id for which the yield is being claimed
    /// @param user The user address that is claiming the yield
    function claimAvailableYield(uint termId, address user) external {
        _claimAvailableYield(termId, user);
    }

    function toggleOptInYG(uint termId) external {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        require(LibYieldGeneration._yieldExists(termId));
        require(
            collateral.state == LibCollateralStorage.CollateralStates.AcceptingCollateral,
            "Too late to change YG opt in"
        );
        require(fund.isParticipant[msg.sender], "User is not participating in the fund");

        bool optIn = !yield.hasOptedIn[msg.sender];
        yield.hasOptedIn[msg.sender] = optIn;
        emit OnYGOptInToggled(termId, msg.sender, optIn);
    }

    function updateYieldProvider(
        string memory providerString,
        address providerAddress
    ) external onlyOwner {
        LibYieldGeneration.YieldProviders storage yieldProvider = LibYieldGeneration
            ._yieldProviders();

        yieldProvider.providerAddresses[providerString] = providerAddress;
    }

    function _claimAvailableYield(uint termId, address user) internal {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        uint availableYield = yield.availableYield[user];
        require(availableYield > 0, "No yield to withdraw");
        yield.availableYield[user] = 0;
        (bool success, ) = payable(user).call{value: availableYield}("");
        require(success);

        emit OnYieldClaimed(termId, user, availableYield);
    }
}
