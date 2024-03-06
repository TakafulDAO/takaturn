// SPDX-License-Identifier: GPL-3.0
/// @notice: This contract is used for test only, it is not used in the mainnet

pragma solidity 0.8.18;

import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";
import {LibWithdrawGoerliEth} from "../libraries/LibWithdrawGoerliEth.sol";
import {LibFundStorage} from "../libraries/LibFundStorage.sol";

contract WithdrawTestEthFacet {
    event OnTestEthWithdraw(uint indexed amount, address indexed receiver);

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    modifier onlyManager(address managerCheck) {
        LibWithdrawGoerliEth._enforceIsTrustedManager(managerCheck);
        _;
    }

    function withdrawTestEth() external onlyOwner onlyManager(msg.sender) {
        uint balance = address(this).balance;
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Withdraw failed");
        emit OnTestEthWithdraw(balance, msg.sender);
    }

    function addTrustedAddress(address newManager) external onlyOwner onlyManager(msg.sender) {
        LibWithdrawGoerliEth._addTrustedAddress(newManager);
    }

    // The next function is to test the error InsufficientBalance on FundFacet is working
    function testInsufficientBalance(uint termId) external onlyOwner onlyManager(msg.sender) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        uint balance = fund.stableToken.balanceOf(address(this));
        bool success = fund.stableToken.transfer(msg.sender, balance);
        require(success, "Transfer failed");
    }

    function testCDworkflow() external pure returns (string memory) {
        return "Test Workflow [demo]";
    }
}
