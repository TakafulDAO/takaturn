# Diamond Template

This template uses the hardhat deploy plug-in wich comes with diamond built-in features and it has implemented the [diamond-3-hardhat](https://github.com/mudgen/diamond-3-hardhat) implementation.

## Settings

- Create a .env file and fill it with the examples on .env.example
- Run `yarn install` to install dependencies
- Run `yarn compile` to compile
- Run `yarn test` to run tests
- Run `yarn coverage` to run test with coverage report
- Run `yarn deploy` to deploy on teporary local network
- Run `yarn n` to run the hardhat node and deploy contracts on it

## Contracts Order Layout

```solidity
// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

//*** IMPORTS INTERFACES ***//
//*** IMPORTS LIBRARIES ***//
//*** IMPORTS CONTRACTS ***//

contract MyContract {
    //*** LIBRARIES USED ***//
    //*** STATE VARIABLES ***//
    //*** MAPPINGS ***//
    //*** EVENTS ***//
    //*** ERRORS ***//
    //*** MODIFIERS ***//
    //*** CONSTRUCTOR ***//
    //*** RECEIVE ***//
    //*** FALLBACK ***//
    //*** EXTERNAL FUNCTIONS ***//
    //*** EXTERNAL VIEW / PURE FUNCTIONS ***//
    //*** PUBLIC FUNCTIONS ***//
    //*** PUBLIC VIEW / PURE FUNCTIONS ***//
    //*** INTERNAL FUNCTIONS ***//
    //*** INTERNAL VIEW / PURE FUNCTIONS ***//
    //*** PRIVATE FUNCTIONS ***//
    //*** PRIVATE VIEW / PURE FUNCTIONS ***//
}
```
