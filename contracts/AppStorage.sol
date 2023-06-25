// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

// This variables can not be initialized here. They have to be initialized in the initialize function
// We can build different structs to group variables
// We can set inmutable and constant variables inside facets

struct AppStorage {
    string name;
    uint256 value;
}
