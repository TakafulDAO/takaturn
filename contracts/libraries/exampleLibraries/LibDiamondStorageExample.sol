// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibDiamondStorageExample {
    bytes32 constant STRUCT_STORAGE_POSITION = keccak256("diamond.storage.example.struct");

    struct StructStorage {
        string name;
        uint256 value;
    }

    function _myStructStorage() internal pure returns (StructStorage storage structStorage) {
        bytes32 position = STRUCT_STORAGE_POSITION;
        assembly {
            structStorage.slot := position
        }
    }
}
