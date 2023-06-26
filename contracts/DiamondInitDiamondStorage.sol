// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibDiamondStorageExample} from "./libraries/exampleLibraries/LibDiamondStorageExample.sol";

contract DiamondInitDiamondStorage {
    function init(string calldata _name, uint256 _value) external {
        LibDiamondStorageExample._myStructStorage().name = _name;
        LibDiamondStorageExample._myStructStorage().value = _value;
    }
}
