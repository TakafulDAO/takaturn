// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "hardhat/console.sol";

library ALibrary {
    function twice(uint256 t) external pure returns (uint256) {
        return t * 2;
    }

    function test() external view {
        console.log("test3");
    }
}
