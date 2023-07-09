// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

//import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library LibTerm {
    uint public constant TERM_VERSION = 1;
    bytes32 constant TERM_STORAGE_POSITION = keccak256("diamond.standard.term.storage");

    struct Term {
        bool initialized;
        address owner;
        uint creationTime;
        uint termId;
        uint totalParticipants;
        uint cycleTime;
        uint contributionAmount;
        uint contributionPeriod;
        uint fixedCollateralEth;
        address stableTokenAddress;
        address aggregatorAddress;
    }

    struct TermStorage {
        uint nextTermId;
        mapping(uint => Term) terms; // termId => Term struct
    }

    function _termExists(uint termId) internal view returns (bool) {
        return _termStorage().terms[termId].initialized;
    }

    function _termStorage() internal pure returns (TermStorage storage termStorage) {
        bytes32 position = TERM_STORAGE_POSITION;
        assembly {
            termStorage.slot := position
        }
    }
}
