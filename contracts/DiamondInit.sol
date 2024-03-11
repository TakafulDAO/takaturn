// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTermStorage} from "./libraries/LibTermStorage.sol";
import {LibYieldGenerationStorage} from "./libraries/LibYieldGenerationStorage.sol";
import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";

contract DiamondInit {
    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @notice Initialize the contract
    /// @param _aggregatorAddressEthUsd Chainlink aggregator address for ETH/USD
    /// @param _aggregatorAddressUsdUsdc Chainlink aggregator address for USDC/USD
    /// @param _zapAddress Zaynfi Zap address
    /// @param _vaultAddress Zaynfi Vault address
    /// @param _yieldLock Yield lock
    function init(
        address _aggregatorAddressEthUsd,
        address _aggregatorAddressUsdUsdc,
        address _zapAddress,
        address _vaultAddress,
        bool _yieldLock
    ) external onlyOwner {
        LibTermStorage.TermConsts storage termConsts = LibTermStorage._termConsts();
        LibYieldGenerationStorage.YieldProviders storage yieldProvider = LibYieldGenerationStorage
            ._yieldProviders();

        termConsts.aggregatorsAddresses["ETH/USD"] = _aggregatorAddressEthUsd;
        termConsts.aggregatorsAddresses["USDC/USD"] = _aggregatorAddressUsdUsdc;

        yieldProvider.providerAddresses["ZaynZap"] = _zapAddress;
        yieldProvider.providerAddresses["ZaynVault"] = _vaultAddress;

        LibYieldGenerationStorage._yieldLock().yieldLock = _yieldLock;
    }
}
