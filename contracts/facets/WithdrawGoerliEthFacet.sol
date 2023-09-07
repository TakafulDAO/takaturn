// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";
import {LibWithdrawGoerliEth} from "../libraries/LibWithdrawGoerliEth.sol";

contract WithdrawGoerliEthFacet {
    event OnGoerliEthWithdraw(uint indexed amount, address indexed receiver);

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    modifier onlyManager(address managerCheck) {
        LibWithdrawGoerliEth._enforceIsTrustedManager(managerCheck);
        _;
    }

    function withdrawGoerliEth() external onlyOwner onlyManager(msg.sender) {
        uint balance = address(this).balance;
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Withdraw failed");
        emit OnGoerliEthWithdraw(balance, msg.sender);
    }

    function addTrustedAddress(address newManager) external onlyOwner onlyManager(msg.sender) {
        LibWithdrawGoerliEth._addTrustedAddress(newManager);
    }
}
