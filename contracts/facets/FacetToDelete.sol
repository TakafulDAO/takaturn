// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

contract FacetToDelete {
    function sayHello(string calldata name) external pure returns (string memory) {
        return string(abi.encodePacked("hello : ", name));
    }

    function sayHello1(string calldata name) external pure returns (string memory) {
        return string(abi.encodePacked("hello1 : ", name));
    }
}
