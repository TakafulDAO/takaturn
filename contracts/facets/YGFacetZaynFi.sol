// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";

import {LibYieldGenerationStorage} from "../libraries/LibYieldGenerationStorage.sol";
import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";
import {LibFundStorage} from "../libraries/LibFundStorage.sol";

contract YGFacetZaynFi is IYGFacetZaynFi {
    event OnYGOptInToggled(uint indexed termId, address indexed user, bool indexed optedIn); // Emits when a user succesfully toggles yield generation
    event OnYieldClaimed(
        uint indexed termId,
        address indexed user,
        address receiver,
        uint indexed amount
    ); // Emits when a user claims their yield

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @notice This function allows a user to claim the current available yield
    /// @param termId The term id for which the yield is being claimed
    function claimAvailableYield(uint termId) external {
        LibYieldGeneration._claimAvailableYield(termId, msg.sender, msg.sender);
    }

    /// @notice This function allows a user to toggle their yield generation
    /// @dev only allowed before the term starts
    /// @param termId The term id for which the yield is being claimed
    function toggleOptInYG(uint termId) external {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];

        require(
            collateral.state == LibCollateralStorage.CollateralStates.AcceptingCollateral,
            "Too late to change YG opt in"
        );
        require(
            collateral.isCollateralMember[msg.sender],
            "Pay the collateral security deposit first"
        );

        bool optIn = !yield.hasOptedIn[msg.sender];
        yield.hasOptedIn[msg.sender] = optIn;
        emit OnYGOptInToggled(termId, msg.sender, optIn);
    }

    /// @notice This function allows the owner to update the global variable for new yield provider
    /// @param providerString The provider string for which the address is being updated
    /// @param providerAddress The new address of the provider
    function updateYieldProvider(
        string memory providerString,
        address providerAddress
    ) external onlyOwner {
        LibYieldGenerationStorage.YieldProviders storage yieldProvider = LibYieldGenerationStorage
            ._yieldProviders();

        yieldProvider.providerAddresses[providerString] = providerAddress;
    }

    /// @notice This function allows the owner to disable the yield generation feature in case of emergency
    function toggleYieldLock() external onlyOwner returns (bool) {
        bool newYieldLock = !LibYieldGenerationStorage._yieldLock().yieldLock;
        LibYieldGenerationStorage._yieldLock().yieldLock = newYieldLock;

        return LibYieldGenerationStorage._yieldLock().yieldLock;
    }

    /// @notice To be used in case of emergency, when the provider needs to change the zap or the vault
    /// @param termId The term id for which the yield is being claimed
    /// @param providerString The provider string for which the address is being updated
    /// @param providerAddress The new address of the provider
    function updateProviderAddressOnTerms(
        uint termId,
        string memory providerString,
        address providerAddress
    ) external onlyOwner {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        require(LibFundStorage._fundExists(termId), "Fund does not exist");
        require(providerAddress != address(0), "Invalid provider address");
        require(
            yield.providerAddresses[providerString] != providerAddress,
            "Same provider address"
        );

        yield.providerAddresses[providerString] = providerAddress;
    }
}
