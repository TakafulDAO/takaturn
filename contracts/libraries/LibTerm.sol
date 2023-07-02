// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

//import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library LibTerm {
    bytes32 constant TERM_STORAGE_POSITION = keccak256("diamond.standard.term.storage");

    struct Term {
        uint totalParticipants;
        uint cycleTime;
        uint contributionAmount;
        uint contributionPeriod;
        uint collateralAmount;
        uint fixedCollateralEth;
        address stableTokenAddress;
        address aggregatorAddress;
    }

    // IMPORTANT: The hash calculation in `TermFacet._getTermId()` assumes
    // that the `nonce` variable is stored at slot 0 inside the `TermStorage` struct
    struct TermStorage {
        uint nonce;
        mapping(bytes32 => Term) terms; // termId => Term struct
    }

    function _termStorage() internal pure returns (TermStorage storage termStorage) {
        bytes32 position = TERM_STORAGE_POSITION;
        assembly {
            termStorage.slot := position
        }
    }
}
