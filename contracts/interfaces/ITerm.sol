// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

// import {IFund} from "../interfaces/IFund.sol";
// import {ICollateral} from "../interfaces/ICollateral.sol";
// import {ITakaturnFactory} from "../interfaces/ITakaturnFactory.sol";
// import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// import {LibFund} from "../libraries/LibFund.sol";
// import {LibTerm} from "../libraries/LibTerm.sol";
// import {LibCollateral} from "../libraries/LibCollateral.sol";

// import {FundFacet} from "./FundFacet.sol";
// import {CollateralFacet} from "./CollateralFacet.sol";

interface ITerm {
    function createTerm(
        uint totalParticipants,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        uint fixedCollateralEth,
        address stableTokenAddress,
        address aggregatorAddress
    ) external returns (uint);

    function joinTerm(uint termId) external;

    function startTerm(uint termId) external;
}
