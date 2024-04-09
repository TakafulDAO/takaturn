// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IZaynZapV2TakaDAO} from "../interfaces/IZaynZapV2TakaDAO.sol";
import {IZaynVaultV2TakaDao} from "../interfaces/IZaynVaultV2TakaDao.sol";

import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";

import {LibYieldGenerationStorage} from "../libraries/LibYieldGenerationStorage.sol";
import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";
import {LibFundStorage} from "../libraries/LibFundStorage.sol";

/// @title Takaturn Yield Facet
/// @author Maikel Ordaz
/// @notice Used to operate the yield generation feature
/// @dev v3.0 (Diamond)
contract YGFacetZaynFi is IYGFacetZaynFi {
    event OnYGOptInToggled(uint indexed termId, address indexed user, bool indexed optedIn); // Emits when a user succesfully toggles yield generation
    event OnYieldClaimed(
        uint indexed termId,
        address indexed user,
        address receiver,
        uint indexed amount
    ); // Emits when a user claims their yield
    event OnYieldReimbursed(uint indexed termId, address indexed user, uint indexed amount); // Emits when a user is reimbursed for a bad transaction
    event OnYieldCompensated(uint indexed termId, address indexed user, uint indexed amount); // Emits when a user is compensated for a bad transaction
    event OnWithdrawnBalanceRestored(
        uint indexed termId,
        address indexed user,
        uint indexed amount
    ); // Emits when a user's withdrawn balance is restored
    event OnYieldTermUpdated(
        uint indexed termId,
        uint indexed amountRestored,
        uint indexed amountCompensated
    ); // Emits when a term's yield balance is restored

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @notice This function allows a user to claim the current available yield
    /// @param termId The term id for which the yield is being claimed
    /// @param receiver The address of the user who will receive the yield
    /// @dev for emergency use only, in case the claimed yield is not sent to the user when withdrawing the collateral
    function claimAvailableYield(uint termId, address receiver) external {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        address[] memory participants = fund.beneficiariesOrder;
        uint participantsLength = participants.length;
        bool canCall;

        for (uint i; i < participantsLength; ) {
            if (participants[i] == msg.sender) {
                canCall = true;
                break;
            }

            unchecked {
                ++i;
            }
        }

        require(canCall, "TT-YF-01");

        LibYieldGeneration._claimAvailableYield(termId, msg.sender, receiver);
    }

    /// @notice This function allows a user to toggle their yield generation
    /// @dev only allowed before the term starts
    /// @dev Revert if the user has not paid the collateral security deposit
    /// @param termId The term id for which the yield is being claimed
    function toggleOptInYG(uint termId) external {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];

        require(
            collateral.state == LibCollateralStorage.CollateralStates.AcceptingCollateral,
            "TT-YF-02"
        );
        require(collateral.isCollateralMember[msg.sender], "TT-YF-03");

        bool optIn = !yield.hasOptedIn[msg.sender];
        yield.hasOptedIn[msg.sender] = optIn;
        emit OnYGOptInToggled(termId, msg.sender, optIn);
    }

    /// @notice This function allows the owner to update the global variable for new yield provider
    /// @param providerString The provider string for which the address is being updated
    /// @param providerAddress The new address of the provider
    function updateYieldProvider(
        string memory providerString,
        address providerAddress
    ) external onlyOwner {
        LibYieldGenerationStorage.YieldProviders storage yieldProvider = LibYieldGenerationStorage
            ._yieldProviders();

        yieldProvider.providerAddresses[providerString] = providerAddress;
    }

    /// @notice This function allows the owner to disable the yield generation feature in case of emergency
    /// @return The new value of the yield lock
    function toggleYieldLock() external onlyOwner returns (bool) {
        bool newYieldLock = !LibYieldGenerationStorage._yieldLock().yieldLock;
        LibYieldGenerationStorage._yieldLock().yieldLock = newYieldLock;

        return LibYieldGenerationStorage._yieldLock().yieldLock;
    }

    /// @notice To be used in case of emergency, when the provider needs to change the zap or the vault
    /// @param termId The term id for which the yield is being claimed
    /// @param providerString The provider string for which the address is being updated
    /// @param providerAddress The new address of the provider
    function updateProviderAddressOnTerms(
        uint termId,
        string memory providerString,
        address providerAddress
    ) external onlyOwner {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        require(LibFundStorage._fundExists(termId), "TT-YF-04");
        require(providerAddress != address(0), "TT-YF-05");
        require(yield.providerAddresses[providerString] != providerAddress, "TT-YF-06");

        yield.providerAddresses[providerString] = providerAddress;
    }

    /// @notice To be used in case of emergency, when yield got stuck in the vault
    /// @notice The position of each array is used as a set in the calculation
    /// @param termIds The term ids for which the yield is being rescued
    /// @param originalWithdrawals The original ETH withdrawal amounts of each bad transaction
    /// @param originalShares The original calculated shares amounts of each bad transaction
    /// @param users The users to be reimbursed
    function rescueStuckYields(
        uint[] memory termIds,
        uint[] memory originalWithdrawals,
        uint[] memory originalShares,
        address[] memory users
    ) external payable onlyOwner {
        // Start with validating the lengths of the arrays
        uint length = termIds.length;
        require(
            length == originalWithdrawals.length &&
                length == originalShares.length &&
                length == users.length,
            "TT-YF-07"
        );

        uint usedValue = 0; // Used to keep track of the lost ETH stored back into zaynfi

        // Start looping through each combination
        for (uint i; i < length; ) {
            uint termId = termIds[i];
            address user = users[i];

            LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
                ._yieldStorage()
                .yields[termId];

            // Make sure user is part of this term and has enabled yield generation
            require(yield.hasOptedIn[user], "TT-YF-08");

            // Zaynfi's addresses
            address vaultAddress = yield.providerAddresses["ZaynVault"];
            address zapAddress = yield.providerAddresses["ZaynZap"];

            // Calculate what each user is owed
            int reimbursement = _calculateReimbursement(
                originalWithdrawals[i],
                originalShares[i],
                yield
            );

            if (reimbursement > 0) {
                // Reimbursement is positive, this means the user withdrew less shares than he was supposed to
                uint neededShares = uint(reimbursement);

                // Code copied from _withdrawYG, get the amount of shares back and give it to the user
                uint withdrawnYield = IZaynZapV2TakaDAO(zapAddress).zapOutETH(
                    vaultAddress,
                    neededShares,
                    termId
                );

                yield.withdrawnYield[user] += withdrawnYield;
                yield.availableYield[user] += withdrawnYield;

                // Claim the yield right away and send it to the user
                LibYieldGeneration._claimAvailableYield(termId, user, user);

                emit OnYieldReimbursed(termId, user, withdrawnYield);
            } else if (reimbursement < 0) {
                // When there is a negative reimbursement, we compensate the pool by adding back the exact amount of shares that were lost
                uint neededShares = uint(reimbursement * -1);

                // Calculate the amount of eth we need to deposit to get the desired shares
                uint pricePerShare = IZaynVaultV2TakaDao(vaultAddress).getPricePerFullShare();

                uint neededEth = (15 * neededShares * pricePerShare) / 10 ** 19; // We ask for 150% of the shares we need to compensate for the slippage
                uint sharesBefore = IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId);

                // Make sure we have enough eth
                require(neededEth + usedValue <= msg.value, "TT-YF-09");

                // Deposit the amount of shares we lost
                IZaynZapV2TakaDAO(zapAddress).zapInEth{value: neededEth}(vaultAddress, termId);

                // Increment the used value so far
                usedValue += neededEth;

                // Validate the amount of shares deposited
                uint sharesAfter = IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId);

                // If we deposited more shares than we needed, we withdraw the extra shares and send them back to the caller
                uint withdrawnExtraEth = IZaynZapV2TakaDAO(zapAddress).zapOutETH(
                    vaultAddress,
                    sharesAfter - sharesBefore - neededShares,
                    termId
                );

                uint sharesFinal = IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId);
                require(neededShares == (sharesFinal - sharesBefore), "TT-YF-10");

                // Give the extra eth back to msg.sender
                usedValue -= withdrawnExtraEth;

                emit OnYieldCompensated(termId, user, (neededEth - withdrawnExtraEth));
            }

            unchecked {
                ++i;
            }
        }

        // Reimburse the leftover eth that the msg.sender sent
        if (usedValue < msg.value) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - usedValue}("");
            require(success, "TT-YF-11");
        }
    }

    /// @notice To be used in case of emergency, when there are more shares deposited than expected
    /// @param termIds The term ids for which the yield balance is to be restored
    function reimburseExtraYield(uint[] memory termIds) external payable onlyOwner {
        uint usedValue = 0; // Used to keep track of the lost ETH stored back into zaynfi
        for (uint i; i < termIds.length; ) {
            uint termId = termIds[i];
            LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
                ._yieldStorage()
                .yields[termId];

            if (!yield.initialized) {
                unchecked {
                    ++i;
                }
                continue;
            }

            // Zaynfi's addresses
            address vaultAddress = yield.providerAddresses["ZaynVault"];
            address zapAddress = yield.providerAddresses["ZaynZap"];

            uint neededShares = (yield.currentTotalDeposit * yield.totalShares) /
                yield.totalDeposit;
            uint actualShares = IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId);

            if (actualShares == neededShares) {
                unchecked {
                    ++i;
                }
                continue;
            }

            address[] memory users = yield.yieldUsers;
            uint reimbursed;
            uint withdrawnYield;

            // Super small values are removed
            if ((actualShares - neededShares) < 100000) {
                // ZapIn some ETH to withdraw the last few shares
                IZaynZapV2TakaDAO(zapAddress).zapInEth{value: 100000}(vaultAddress, termId);
                usedValue += 100000;
                withdrawnYield = IZaynZapV2TakaDAO(zapAddress).zapOutETH(
                    vaultAddress,
                    IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId) - neededShares,
                    termId
                );
                // Send back to msg.sender because there is no profit here
                usedValue -= withdrawnYield;

                require(
                    neededShares == IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId),
                    "TT-YF-12"
                );

                unchecked {
                    ++i;
                }
                continue;
            }

            for (uint j; j < users.length; ) {
                address user = users[j];

                uint toWithdraw;

                // Prevent rounding errors and make sure everything is withdrawn. This is done at the last user.
                if (j + 1 == users.length) {
                    toWithdraw = actualShares - neededShares - reimbursed;
                } else {
                    // Distribute the extra shares based on the yield distribution ratio
                    toWithdraw =
                        ((actualShares - neededShares) * yield.depositedCollateralByUser[user]) /
                        yield.totalDeposit;
                    reimbursed += toWithdraw;
                }

                // ZapOut the user's portion
                withdrawnYield = IZaynZapV2TakaDAO(zapAddress).zapOutETH(
                    vaultAddress,
                    toWithdraw,
                    termId
                );

                yield.withdrawnYield[user] += withdrawnYield;
                yield.availableYield[user] += withdrawnYield;

                // Claim the yield right away and send it to the user
                LibYieldGeneration._claimAvailableYield(termId, user, user);

                emit OnYieldCompensated(termId, user, withdrawnYield);

                unchecked {
                    ++j;
                }
            }

            require(
                neededShares == IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId),
                "TT-YF-12"
            );

            unchecked {
                ++i;
            }
        }

        // Reimburse the leftover eth that the msg.sender sent
        if (usedValue < msg.value) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - usedValue}("");
            require(success, "TT-YF-11");
        }
    }

    /// @notice To be used in case of emergency, when the user has withdrawn too much eth from yield into the smart contract
    /// @param termIds The term ids for which the yield balance is to be restored
    function restoreYieldBalance(uint[] memory termIds) external payable onlyOwner {
        uint usedValue = 0; // Used to keep track of the lost ETH stored back into zaynfi
        // Start looping through each term id
        for (uint i; i < termIds.length; ) {
            uint termId = termIds[i];
            LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
                ._yieldStorage()
                .yields[termId];

            if (!yield.initialized) {
                unchecked {
                    ++i;
                }
                continue;
            }

            // Zaynfi's addresses
            address vaultAddress = yield.providerAddresses["ZaynVault"];
            address zapAddress = yield.providerAddresses["ZaynZap"];

            // Validate currentTotalDeposit to match the expected shares
            uint neededShares = (yield.currentTotalDeposit * yield.totalShares) /
                yield.totalDeposit;

            require(
                neededShares == IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId),
                "TT-YF-13"
            );

            // Deal with the case where the user has withdrawn too much eth from yield
            // The user did not actually withdraw more ETH to his wallet, just that it was withdrawn back to the smart contract
            // So no ETH was lost
            address[] memory users = yield.yieldUsers;
            uint withdrawnTooMuch;

            for (uint j; j < users.length; ) {
                address user = users[j];

                uint withdraw = yield.withdrawnCollateral[user];
                uint deposit = yield.depositedCollateralByUser[user];

                if (withdraw > deposit) {
                    withdrawnTooMuch += (withdraw - deposit);

                    // Restore the withdrawnCollateral amount of the user to what it's supposed to be
                    yield.withdrawnCollateral[user] = deposit;

                    emit OnWithdrawnBalanceRestored(termId, user, deposit);
                }

                unchecked {
                    ++j;
                }
            }

            // Safety check but most likely the case
            if (withdrawnTooMuch == 0) {
                unchecked {
                    ++i;
                }
                continue;
            }

            // Restore currentTotalDeposit to what it's supposed to be
            yield.currentTotalDeposit += withdrawnTooMuch;

            // We calculate the current shares we actually need in total for this term
            neededShares = (yield.currentTotalDeposit * yield.totalShares) / yield.totalDeposit;

            // withdrawnTooMuch was withdrawn back to the smart contract, we must send it back to the yield vault
            IZaynZapV2TakaDAO(zapAddress).zapInEth{value: withdrawnTooMuch}(vaultAddress, termId);

            // Get the shares after
            uint sharesBalance = IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId);
            if (neededShares > sharesBalance) {
                // If we still need more shares (which is most likely the case), we compensate by putting the missing amount into the vault
                // Calculate the amount of eth we need to deposit to get the desired shares
                uint pricePerShare = IZaynVaultV2TakaDao(vaultAddress).getPricePerFullShare();

                uint neededEth = (15 * (neededShares - sharesBalance) * pricePerShare) / 10 ** 19; // We ask for 150% of the shares we need to compensate for the slippage

                // Make sure we have enough eth
                require(neededEth + usedValue <= msg.value, "TT-YF-09");

                // Deposit the amount of shares we lost
                IZaynZapV2TakaDAO(zapAddress).zapInEth{value: neededEth}(vaultAddress, termId);

                // Increment the used value so far
                usedValue += neededEth;

                // Validate the amount of shares deposited
                sharesBalance = IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId);

                // If we deposited more shares than we needed, we withdraw the extra shares and send them back to the caller
                uint withdrawnExtraEth = IZaynZapV2TakaDAO(zapAddress).zapOutETH(
                    vaultAddress,
                    sharesBalance - neededShares,
                    termId
                );

                require(
                    neededShares == IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId),
                    "TT-YF-10"
                );

                // Give the extra eth back to msg.sender
                usedValue -= withdrawnExtraEth;

                emit OnYieldTermUpdated(termId, withdrawnTooMuch, (neededEth - withdrawnExtraEth));
            } else if (sharesBalance > neededShares) {
                // If we deposited more shares than we needed, we withdraw the extra shares and send them back to the caller
                IZaynZapV2TakaDAO(zapAddress).zapOutETH(
                    vaultAddress,
                    sharesBalance - neededShares,
                    termId
                );

                emit OnYieldTermUpdated(termId, withdrawnTooMuch, 0);
            }

            // Some sanity checks
            uint currentTotalDeposit;
            for (uint j; j < users.length; ) {
                address user = users[j];
                uint withdraw = yield.withdrawnCollateral[user];
                uint deposit = yield.depositedCollateralByUser[user];
                require(deposit >= withdraw, "TT-YF-14");

                currentTotalDeposit +=
                    yield.depositedCollateralByUser[user] -
                    yield.withdrawnCollateral[user];

                unchecked {
                    ++j;
                }
            }

            require(yield.currentTotalDeposit == currentTotalDeposit, "TT-YF-15");

            uint currentShares = (currentTotalDeposit * yield.totalShares) / yield.totalDeposit;

            require(
                currentShares == IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId),
                "TT-YF-16"
            );

            unchecked {
                ++i;
            }
        }

        // Reimburse the leftover eth that the msg.sender sent
        if (usedValue < msg.value) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - usedValue}("");
            require(success, "TT-YF-11");
        }
    }

    /// @notice To be used in case of emergency, when yield got stuck in the vault
    /// @notice The position of each array is used as a set in the calculation
    /// @param originalWithdrawal The original ETH withdrawal amount
    /// @param originalShares The original calculated shares amount
    /// @param yield the reference to the yield
    function _calculateReimbursement(
        uint originalWithdrawal,
        uint originalShares,
        LibYieldGenerationStorage.YieldGeneration storage yield
    ) internal view returns (int) {
        uint correctedShares = (originalWithdrawal * yield.totalShares) / yield.totalDeposit;

        if (correctedShares > originalShares) {
            return int(correctedShares - originalShares);
        } else if (correctedShares < originalShares) {
            return int(originalShares - correctedShares) * -1;
        }

        return 0;
    }
}
