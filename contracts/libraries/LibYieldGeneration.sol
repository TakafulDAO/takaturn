// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibYieldGeneration {
    uint public constant YIELD_GENERATION_VERSION = 1;
    bytes32 constant YIELD_PROVIDERS_POSITION = keccak256("diamond.standard.yield.providers");
    bytes32 constant YIELD_STORAGE_POSITION = keccak256("diamond.standard.yield.storage");

    enum YGProviders {
        InHouse,
        ZaynFi
    }

    // Both index 0 are reserved for ZaynFi
    struct YieldProviders {
        mapping(string => address) providerAddresses;
    }

    struct YieldGeneration {
        bool initialized;
        YGProviders provider;
        mapping(string => address) providerAddresses;
        uint startTimeStamp;
        uint totalDeposit;
        uint currentTotalDeposit;
        uint totalShares;
        address[] yieldUsers;
        mapping(address => bool) hasOptedIn;
        mapping(address => uint256) withdrawnYield;
        mapping(address => uint256) withdrawnCollateral;
        mapping(address => uint256) availableYield;
    }

    struct YieldStorage {
        mapping(uint => YieldGeneration) yields; // termId => YieldGeneration struct
    }

    function _yieldExists(uint termId) internal view returns (bool) {
        return _yieldStorage().yields[termId].initialized;
    }

    function _yieldProviders() internal pure returns (YieldProviders storage yieldProviders) {
        bytes32 position = YIELD_PROVIDERS_POSITION;
        assembly {
            yieldProviders.slot := position
        }
    }

    function _yieldStorage() internal pure returns (YieldStorage storage yieldStorage) {
        bytes32 position = YIELD_STORAGE_POSITION;
        assembly {
            yieldStorage.slot := position
        }
    }

    function _sharesToEth(
        uint _currentShares,
        uint _totalDeposit,
        uint _totalShares
    ) internal pure returns (uint) {
        return (_currentShares * _totalDeposit) / _totalShares;
    }

    function _ethToShares(
        uint _collateralAmount,
        uint _totalShares,
        uint _totalDeposit
    ) internal pure returns (uint) {
        return (_collateralAmount * _totalShares) / _totalDeposit;
    }
}
