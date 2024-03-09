// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract StratManager is Ownable, Pausable {
    /**
     * @dev Zayn Fi Contracts:
     * {manager} - Address to manage a few lower risk features of the strat
     * {strategist} - Address of the strategy author/deployer where strategist fee will go.
     * {vault} - Address of the vault that controls the strategy's funds.
     * {unirouter} - Address of exchange to execute swaps.
     */
    address public manager;
    address public strategist;
    address public unirouter;
    address public vault;
    address public zaynFeeRecipient;

    /**
     * @dev Initializes the base strategy.
     * @param _manager address to use as alternative owner.
     * @param _strategist address where strategist fees go.
     * @param _unirouter router to use for swaps
     * @param _vault address of parent vault.
     * @param _zaynFeeRecipient address where to send Zayn's fees.
     */
    constructor(
        address _manager,
        address _strategist,
        address _unirouter,
        address _vault,
        address _zaynFeeRecipient
    ) {
        manager = _manager;
        strategist = _strategist;
        unirouter = _unirouter;
        vault = _vault;
        zaynFeeRecipient = _zaynFeeRecipient;
    }

    // checks that caller is either owner or manager.
    modifier onlyManager() {
        require(msg.sender == owner() || msg.sender == manager, "!manager");
        _;
    }

    function setManager(address _manager) external onlyManager {
        manager = _manager;
    }

    /**
     * @dev Updates address where strategist fee earnings will go.
     * @param _strategist new strategist address.
     */
    function setStrategist(address _strategist) external {
        require(msg.sender == strategist, "!strategist");
        strategist = _strategist;
    }

    /**
     * @dev Updates router that will be used for swaps.
     * @param _unirouter new unirouter address.
     */
    function setUnirouter(address _unirouter) external onlyOwner {
        unirouter = _unirouter;
    }

    /**
     * @dev Updates parent vault.
     * @param _vault new vault address.
     */
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    /**
     * @dev Updates Zayn's fee recipient.
     * @param _zaynFeeRecipient new Zayn's fee recipient address.
     */
    function setZaynFeeRecipient(address _zaynFeeRecipient) external onlyOwner {
        zaynFeeRecipient = _zaynFeeRecipient;
    }

    /**
     * @dev Function to synchronize balances before new user deposit.
     * Can be overridden in the strategy.
     */
    function beforeDeposit() external virtual {}

    /**
     * @dev Function to synchronize different want tokens if strategy is changed in vault
     * Can be overridden in the strategy.
     */
    function migrate() external virtual {}
}
