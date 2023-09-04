// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTerm} from "./libraries/LibTerm.sol";
import {LibYieldGeneration} from "./libraries/LibYieldGeneration.sol";

contract DiamondInit {
    function init(
        address _aggregatorAddressEthUsd,
        address _aggregatorAddressUsdUsdc,
        address _sequencerUptimeFeedAddress,
        address _zapAddress, // Zaynfi Zap address
        address _vaultAddress // Zaynfi Vault address
    ) external {
        LibTerm.TermConsts storage termConsts = LibTerm._termConsts();
        LibYieldGeneration.YieldProviders storage yieldProvider = LibYieldGeneration
            ._yieldProviders();

        termConsts.sequencerStartupTime = 3600; // The sequencer must be running for at least an hour before it's reliable
        termConsts.aggregatorsAddresses["ETH/USD"] = _aggregatorAddressEthUsd;
        termConsts.aggregatorsAddresses["USD/USDC"] = _aggregatorAddressUsdUsdc;
        termConsts.sequencerUptimeFeedAddress = _sequencerUptimeFeedAddress;

        yieldProvider.providerAddresses["ZaynZap"] = _zapAddress;
        yieldProvider.providerAddresses["ZaynVault"] = _vaultAddress;
    }
}
