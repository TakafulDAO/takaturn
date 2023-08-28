// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibYieldGeneration {
    uint public constant YIELD_GENERATION_VERSION = 1;
    bytes32 constant YIELD_STORAGE_POSITION = keccak256("diamond.standard.yield.storage");

    enum YGProviders {
        InHouse,
        ZaynFi
    }

    struct YieldGeneration {
        bool initialized;
        YGProviders provider;
        address[] yieldProviders; // index 0 zap, index 1 vault
        address[] yieldUsers;
        uint startTimeStamp;
        mapping(address => bool) hasOptedIn;
        uint totalDeposit;
        uint currentTotalDeposit;
        mapping(address => uint256) withdrawnYield;
        mapping(address => uint256) withdrawnCollateral;
    }

    struct YieldStorage {
        mapping(uint => YieldGeneration) yields; // termId => YieldGeneration struct
    }

    function _yieldExists(uint termId) internal view returns (bool) {
        return _yieldStorage().yields[termId].initialized;
    }

    function _yieldStorage() internal pure returns (YieldStorage storage yieldStorage) {
        bytes32 position = YIELD_STORAGE_POSITION;
        assembly {
            yieldStorage.slot := position
        }
    }
}
