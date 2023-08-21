// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibYieldGeneration {
    uint public constant YIELD_GENERATION_VERSION = 1;
    bytes32 constant YIELD_GENERATION_CONSTS_POSITION =
        keccak256("diamond.standard.yield.generation.consts");
    bytes32 constant YIELD_GENERATION_POSITION = keccak256("diamond.standard.yield.generation");

    struct YieldGenerationConsts {
        address zapAddress;
        address vaultAddress;
    }

    struct YieldGeneration {
        bool initialized;
        uint startTimeStamp;
        mapping(address => bool) hasOptedIn;
        uint totalDeposit;
        uint currentTotalDeposit;
    }

    function _yieldGenerationConsts()
        internal
        pure
        returns (YieldGenerationConsts storage yieldGenerationConsts)
    {
        bytes32 position = YIELD_GENERATION_CONSTS_POSITION;
        assembly {
            yieldGenerationConsts.slot := position
        }
    }

    function _yieldGeneration() internal pure returns (YieldGeneration storage yieldGeneration) {
        bytes32 position = YIELD_GENERATION_POSITION;
        assembly {
            yieldGeneration.slot := position
        }
    }
}
