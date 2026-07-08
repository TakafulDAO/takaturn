// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

interface IYGOwnerClaimFacetZaynFi {
    /// @notice This function allows a user to claim the current available yield
    /// @param users The addresses of the users who are claiming the yield
    /// @param termIds The term ids for which the yield is being claimed
    /// @param receivers The addresses of the users who will receive the yield
    /// @dev for emergency use only, in case the claimed yield is not sent to the user when withdrawing the collateral
    function claimAvailableYieldForUser(
        address[] calldata users,
        uint256[] calldata termIds,
        address[] calldata receivers
    ) external;
}
