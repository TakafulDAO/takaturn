// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {LibTermStorage} from "../libraries/LibTermStorage.sol";

interface IYGFacetZaynFi {
    /// @notice This function allows a user to claim the current available yield
    /// @param termId The term id for which the yield is being claimed
    /// @param receiver The address of the user who will receive the yield
    /// @dev for emergency use only, in case the claimed yield is not sent to the user when withdrawing the collateral
    function claimAvailableYield(uint termId, address receiver) external;

    /// @notice This function allows a user to toggle their yield generation
    /// @dev only allowed before the term starts
    /// @dev Revert if the user has not paid the collateral security deposit
    /// @param termId The term id for which the yield is being claimed
    function toggleOptInYG(uint termId) external;

    /// @notice This function allows the owner to update the global variable for new yield provider
    /// @param providerString The provider string for which the address is being updated
    /// @param providerAddress The new address of the provider
    function updateYieldProvider(string memory providerString, address providerAddress) external;

    /// @notice This function allows the owner to disable the yield generation feature in case of emergency
    /// @return The new value of the yield lock
    function toggleYieldLock() external returns (bool);

    /// @notice To be used in case of emergency, when the provider needs to change the zap or the vault
    /// @param termId The term id for which the yield is being claimed
    /// @param providerString The provider string for which the address is being updated
    /// @param providerAddress The new address of the provider
    function updateProviderAddressOnTerms(
        uint termId,
        string memory providerString,
        address providerAddress
    ) external;
}
