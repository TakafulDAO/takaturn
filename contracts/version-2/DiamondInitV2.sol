// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTermV2} from "./libraries/LibTermV2.sol";

// todo: set zapAddress and vaultAddress
contract DiamondInitV2 {
    function init(
        address _aggregatorAddressEthUsd,
        address _aggregatorAddressUsdUsdc,
        address _sequencerUptimeFeedAddress
    ) external {
        LibTermV2.TermConsts storage termConsts = LibTermV2._termConsts();
        termConsts.sequencerStartupTime = 3600; // The sequencer must be running for at least an hour before it's reliable
        termConsts.aggregatorsAddresses["ETH/USD"] = _aggregatorAddressEthUsd;
        termConsts.aggregatorsAddresses["USD/USDC"] = _aggregatorAddressUsdUsdc;
        termConsts.sequencerUptimeFeedAddress = _sequencerUptimeFeedAddress;
    }
}
