// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTerm} from "./libraries/LibTerm.sol";
import {LibYieldGeneration} from "./libraries/LibYieldGeneration.sol";

contract DiamondInit {
    function init(
        address _aggregatorAddressEthUsd,
        address _aggregatorAddressUsdUsdc,
        address _zapAddress, // Zaynfi Zap address
        address _vaultAddress // Zaynfi Vault address
    ) external {
        LibTerm.TermConsts storage termConsts = LibTerm._termConsts();
        LibYieldGeneration.YieldProviders storage yieldProvider = LibYieldGeneration
            ._yieldProviders();

        termConsts.aggregatorsAddresses["ETH/USD"] = _aggregatorAddressEthUsd;
        termConsts.aggregatorsAddresses["USDC/USD"] = _aggregatorAddressUsdUsdc;

        yieldProvider.providerAddresses["ZaynZap"] = _zapAddress;
        yieldProvider.providerAddresses["ZaynVault"] = _vaultAddress;
    }
}
