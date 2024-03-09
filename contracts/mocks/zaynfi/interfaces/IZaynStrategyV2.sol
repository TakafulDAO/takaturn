// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;

interface IZaynStrategyV2 {
    function wantUnderlyingToken() external view returns (address);

    function revShareToken() external view returns (address);
}
