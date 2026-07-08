// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IYGOwnerClaimFacetZaynFi} from "../interfaces/IYGOwnerClaimFacetZaynFi.sol";

import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {LibYieldGenerationStorage} from "../libraries/LibYieldGenerationStorage.sol";
import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";
import {LibFundStorage} from "../libraries/LibFundStorage.sol";

/// @title Takaturn Emergency Yield claim Facet
/// @author Maikel Ordaz
/// @dev v3.0 (Diamond)
contract YGOwnerClaimFacetZaynFi is IYGOwnerClaimFacetZaynFi {
    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @notice This function allows a user to claim the current available yield
    /// @param users The addresses of the users who are claiming the yield
    /// @param termIds The term ids for which the yield is being claimed
    /// @param receivers The addresses of the users who will receive the yield
    /// @dev for emergency use only, in case the claimed yield is not sent to the user when withdrawing the collateral
    function claimAvailableYieldForUser(
        address[] calldata users,
        uint256[] calldata termIds,
        address[] calldata receivers
    ) external onlyOwner {
        require(users.length == termIds.length && users.length == receivers.length);

        uint256 length = users.length;

        for (uint256 i; i < length;) {
            _claimAvailableYield(users[i], termIds[i], receivers[i]);

            unchecked {
                ++i;
            }
        }
    }

    function _claimAvailableYield(address _user, uint256 _termId, address _receiver) internal {
        require(_user != address(0) && _receiver != address(0), "TT-YF-01");
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[_termId];
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_termId];

        address[] memory participants = fund.beneficiariesOrder;
        uint256 participantsLength = participants.length;
        bool canCall;

        for (uint256 i; i < participantsLength;) {
            if (participants[i] == _user) {
                canCall = true;
                break;
            }

            unchecked {
                ++i;
            }
        }

        require(canCall, "TT-YF-01");

        if (yield.availableYield[_user] == 0) {
            return;
        }

        LibYieldGeneration._claimAvailableYield(_termId, _user, _receiver);
    }
}
