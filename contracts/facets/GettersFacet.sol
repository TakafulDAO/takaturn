// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {LibTerm} from "../libraries/LibTerm.sol";

contract GettersFacet {
    function getLastTermId() external view returns (uint) {
        return (LibTerm._termStorage().nextTermId);
    }

    function getTermSummary(uint id) external view returns (uint, uint, uint, uint, uint, address) {
        LibTerm.Term memory term = LibTerm._termStorage().terms[id];
        return (
            term.totalParticipants,
            term.cycleTime,
            term.contributionAmount,
            term.contributionPeriod,
            term.fixedCollateralEth,
            term.stableTokenAddress
        );
    }
}
