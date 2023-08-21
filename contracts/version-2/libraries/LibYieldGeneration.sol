// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibYieldGeneration {
    uint public constant YIELD_GENERATION_VERSION = 1;
    bytes32 constant YIELD_GENERATION_CONSTS_POSITION =
        keccak256("diamond.standard.yield.generation.consts");
    bytes32 constant YIELD_STORAGE_POSITION = keccak256("diamond.standard.yield.storage");

    struct YieldGenerationConsts {
        address zapAddress;
        address vaultAddress;
    }

    struct YieldGeneration {
        bool initialized;
        address[] providersAddresses;
        uint startTimeStamp;
        mapping(address => bool) hasOptedIn;
        uint totalDeposit;
        uint currentTotalDeposit;
        mapping(address => uint256) withdrawnYield;
    }

    struct YieldStorage {
        mapping(uint => YieldGeneration) yields; // termId => Fund struct
    }

    function _yieldExists(uint termId) internal view returns (bool) {
        return _yieldStorage().yields[termId].initialized;
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

    function _yieldStorage() internal pure returns (YieldStorage storage yieldStorage) {
        bytes32 position = YIELD_STORAGE_POSITION;
        assembly {
            yieldStorage.slot := position
        }
    }
}
