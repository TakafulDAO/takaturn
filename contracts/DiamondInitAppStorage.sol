// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {AppStorage} from "./AppStorage.sol";

contract DiamondInitAppStorage {
    AppStorage internal s;

    function init(string calldata _name, uint256 _value) external {
        s.name = _name;
        s.value = _value;
    }
}
