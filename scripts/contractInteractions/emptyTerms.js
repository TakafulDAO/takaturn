/* scripts/contractInteractions/emptyTerms.js
 *
 * Run with:
 *   yarn hardhat run scripts/contractInteractions/emptyTerms.js
 *
 * Requires .env:
 *   BACKEND_PK=0x...
 *   ARBITRUM_MAINNET_RPC_URL=your_rpc_url
 */

"use strict"
require("dotenv").config()

const fs = require("fs")
const path = require("path")
const hre = require("hardhat")
const { ethers } = hre

async function main() {
    // ---------- Config ----------
    const TAKATURN_ADDRESS = "0x00042e3895f5eF16b96bc904B9ACc92509624eA2"
    const TAKATURN_MULTISIG = "0x90D61b1cebE95B24E4C1DAc97460A221Fd1B8d87"
    const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" // native USDC on Arbitrum One

    const collateralTermIds = [
        14, 18, 19, 29, 30, 31, 33, 47, 48, 51, 52, 53, 67, 71, 75, 81, 99, 100, 105, 110, 116, 121,
        129,
    ]
    const fundTermIds = [14, 19, 30, 33, 47, 48, 49, 51, 53, 75, 81, 83, 99, 100, 116, 119]

    const RPC_URL = process.env.ARBITRUM_MAINNET_RPC_URL
    const PK = process.env.BACKEND_PK
    if (!RPC_URL || !PK) {
        throw new Error(
            "Missing env vars. Please set ARBITRUM_MAINNET_RPC_URL and BACKEND_PK in your .env"
        )
    }

    // ---------- IO setup ----------
    const outDir = path.resolve("scripts/output")
    fs.mkdirSync(outDir, { recursive: true })
    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .replace("Z", "")
    const csvPath = path.join(outDir, `empty-after-end_${timestamp}.csv`)
    const csvHeader =
        "time_iso,action,termId,txHash,eth_before_wei,eth_after_wei,eth_delta_wei,usdc_before,usdc_after,usdc_delta,status,error\n"
    fs.writeFileSync(csvPath, csvHeader, { encoding: "utf8" })

    const logCsv = (rowObj) => {
        const safe = (v) => (v === undefined || v === null ? "" : String(v))
        const line = [
            safe(rowObj.time_iso),
            safe(rowObj.action),
            safe(rowObj.termId),
            safe(rowObj.txHash),
            safe(rowObj.eth_before_wei),
            safe(rowObj.eth_after_wei),
            safe(rowObj.eth_delta_wei),
            safe(rowObj.usdc_before),
            safe(rowObj.usdc_after),
            safe(rowObj.usdc_delta),
            safe(rowObj.status),
            safe(rowObj.error).replace(/\n/g, " ").replace(/,/g, ";"),
        ].join(",")
        fs.appendFileSync(csvPath, line + "\n", { encoding: "utf8" })
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const net = await provider.getNetwork()
    if (Number(net.chainId) !== 42161) {
        throw new Error(
            `Connected to chainId=${net.chainId}, expected Arbitrum One (42161). Check ARBITRUM_MAINNET_RPC_URL`
        )
    }

    const wallet = new ethers.Wallet(PK, provider)
    const who = await wallet.getAddress()
    console.log(`Using signer: ${who}`)
    console.log(`Network: Arbitrum One (chainId ${net.chainId})`)
    console.log(`Logging to: ${csvPath}`)
    console.log("")

    // ---------- ABIs ----------
    const targetAbi = [
        "function emptyCollateralAfterEnd(uint256 termId) external",
        "function emptyFundAfterEnd(uint256 termId) external",
    ]
    const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "function transfer(address,uint256) returns (bool)",
    ]

    // ---------- Contracts ----------
    // Sanity: code exists
    const code = await provider.getCode(TAKATURN_ADDRESS)
    if (code === "0x") {
        throw new Error(
            `No contract code at ${TAKATURN_ADDRESS} on Arbitrum One. Double-check the address.`
        )
    }

    const target = new ethers.Contract(TAKATURN_ADDRESS, targetAbi, wallet)
    const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, wallet)
    const usdcDecimals = await usdc.decimals().catch(() => 6)
    const usdcSymbol = await usdc.symbol().catch(() => "USDC")

    // ---------- Helpers ----------
    const nowISO = () => new Date().toISOString()
    const getEth = async (addr) => await provider.getBalance(addr) // BigInt
    const getUsdc = async (addr) => await usdc.balanceOf(addr) // BigInt (scaled)
    const printTx = (label, tx) => console.log(`${label} tx: ${tx.hash} (nonce ${tx.nonce})`)

    // Run a callable, log deltas and CSV
    const doCallAndCheck = async ({
        action,
        termId,
        callFn,
        expectIncrease, // "eth" | "usdc"
    }) => {
        const preEth = await getEth(who)
        const preUsdc = await getUsdc(who)

        // static calls to catch guaranteed reverts
        try {
            if (action === "emptyCollateral") {
                await target.emptyCollateralAfterEnd.staticCall(termId)
            } else if (action === "emptyFund") {
                await target.emptyFundAfterEnd.staticCall(termId)
            }
        } catch (e) {
            console.warn(
                `[WARN] staticCall revert for ${action} termId=${termId}: ${
                    e?.shortMessage || e?.message
                }`
            )
            logCsv({
                time_iso: nowISO(),
                action,
                termId,
                txHash: "",
                eth_before_wei: preEth.toString(),
                eth_after_wei: preEth.toString(),
                eth_delta_wei: "0",
                usdc_before: preUsdc.toString(),
                usdc_after: preUsdc.toString(),
                usdc_delta: "0",
                status: "static_revert",
                error: e?.shortMessage || e?.message || "",
            })
            return
        }

        // Send tx
        let tx
        try {
            tx =
                action === "emptyCollateral"
                    ? await target.emptyCollateralAfterEnd(termId)
                    : await target.emptyFundAfterEnd(termId)
            printTx(`${action} termId=${termId}`, tx)
        } catch (e) {
            console.error(
                `[ERROR] failed to send ${action} termId=${termId}: ${
                    e?.shortMessage || e?.message
                }`
            )
            logCsv({
                time_iso: nowISO(),
                action,
                termId,
                txHash: "",
                eth_before_wei: preEth.toString(),
                eth_after_wei: preEth.toString(),
                eth_delta_wei: "0",
                usdc_before: preUsdc.toString(),
                usdc_after: preUsdc.toString(),
                usdc_delta: "0",
                status: "send_error",
                error: e?.shortMessage || e?.message || "",
            })
            return
        }

        // Wait mined
        const receipt = await tx.wait(1)
        const postEth = await getEth(who)
        const postUsdc = await getUsdc(who)

        const deltaEth = (postEth - preEth).toString()
        const deltaUsdc = (postUsdc - preUsdc).toString()

        // Expectation checks
        if (expectIncrease === "eth" && postEth <= preEth) {
            console.warn(
                `[WARN] ETH did not increase after ${action} termId=${termId}. ΔETH=${deltaEth}`
            )
        }
        if (expectIncrease === "usdc" && postUsdc <= preUsdc) {
            console.warn(
                `[WARN] ${usdcSymbol} did not increase after ${action} termId=${termId}. ΔUSDC=${deltaUsdc}`
            )
        }

        logCsv({
            time_iso: nowISO(),
            action,
            termId,
            txHash: tx.hash,
            eth_before_wei: preEth.toString(),
            eth_after_wei: postEth.toString(),
            eth_delta_wei: deltaEth,
            usdc_before: preUsdc.toString(),
            usdc_after: postUsdc.toString(),
            usdc_delta: deltaUsdc,
            status: receipt.status === 1 ? "success" : "failed",
            error: "",
        })
    }

    // ---------- Execute: Collateral empties ----------
    console.log("=== emptyCollateralAfterEnd (expect ETH increase) ===")
    for (const termId of collateralTermIds) {
        await doCallAndCheck({
            action: "emptyCollateral",
            termId,
            expectIncrease: "eth",
        })
    }

    // ---------- Execute: Fund empties ----------
    console.log("\n=== emptyFundAfterEnd (expect USDC increase) ===")
    for (const termId of fundTermIds) {
        await doCallAndCheck({
            action: "emptyFund",
            termId,
            expectIncrease: "usdc",
        })
    }

    // ---------- Sweep USDC first ----------
    console.log("\n=== Sweeping USDC ===")
    const usdcBal = await getUsdc(who)
    if (usdcBal > 0n) {
        try {
            const tx = await usdc.transfer(TAKATURN_MULTISIG, usdcBal)
            printTx(`USDC->${TAKATURN_MULTISIG}`, tx)
            const rc = await tx.wait(1)
            logCsv({
                time_iso: nowISO(),
                action: "sweepUSDC",
                termId: "",
                txHash: tx.hash,
                eth_before_wei: "",
                eth_after_wei: "",
                eth_delta_wei: "",
                usdc_before: usdcBal.toString(),
                usdc_after: "0",
                usdc_delta: `-${usdcBal.toString()}`,
                status: rc.status === 1 ? "success" : "failed",
                error: "",
            })
        } catch (e) {
            console.error(`[ERROR] sweeping USDC: ${e?.shortMessage || e?.message}`)
            logCsv({
                time_iso: nowISO(),
                action: "sweepUSDC",
                termId: "",
                txHash: "",
                eth_before_wei: "",
                eth_after_wei: "",
                eth_delta_wei: "",
                usdc_before: usdcBal.toString(),
                usdc_after: usdcBal.toString(),
                usdc_delta: "0",
                status: "send_error",
                error: e?.shortMessage || e?.message || "",
            })
        }
    } else {
        console.log("No USDC to sweep.")
    }

    // ---------- Sweep ETH ----------
    console.log("\n=== Sweeping ETH ===")
    let ethBal = await getEth(who)
    if (ethBal > 0n) {
        try {
            // Estimate gas and fee for simple transfer
            const gasEstimate = await provider.estimateGas({
                to: TAKATURN_MULTISIG,
                from: who,
                value: 1n, // placeholder nonzero for estimation
            })
            const feeData = await provider.getFeeData()
            let valueToSend = ethBal

            if (feeData.maxFeePerGas) {
                const maxFee = gasEstimate * feeData.maxFeePerGas
                if (ethBal > maxFee) valueToSend = ethBal - maxFee
                else valueToSend = 0n
                if (valueToSend > 100000000000000n) valueToSend -= 100000000000000n // 0.0001 ETH buffer
            } else if (feeData.gasPrice) {
                const maxFee = gasEstimate * feeData.gasPrice
                if (ethBal > maxFee) valueToSend = ethBal - maxFee
                else valueToSend = 0n
                if (valueToSend > 100000000000000n) valueToSend -= 100000000000000n
            } else {
                // Fallback: send 90% if we can't estimate properly
                valueToSend = (ethBal * 9n) / 10n
            }

            if (valueToSend <= 0n) {
                console.warn("Insufficient ETH to cover gas for sweep. Skipping ETH sweep.")
                logCsv({
                    time_iso: nowISO(),
                    action: "sweepETH",
                    termId: "",
                    txHash: "",
                    eth_before_wei: ethBal.toString(),
                    eth_after_wei: ethBal.toString(),
                    eth_delta_wei: "0",
                    usdc_before: "",
                    usdc_after: "",
                    usdc_delta: "",
                    status: "skipped_insufficient",
                    error: "",
                })
            } else {
                const tx = await wallet.sendTransaction({
                    to: TAKATURN_MULTISIG,
                    value: valueToSend,
                    // Let provider fill fee fields
                })
                printTx(`ETH->${TAKATURN_MULTISIG}`, tx)
                const rc = await tx.wait(1)
                const postEth = await getEth(who)
                logCsv({
                    time_iso: nowISO(),
                    action: "sweepETH",
                    termId: "",
                    txHash: tx.hash,
                    eth_before_wei: ethBal.toString(),
                    eth_after_wei: postEth.toString(),
                    eth_delta_wei: (postEth - ethBal).toString(),
                    usdc_before: "",
                    usdc_after: "",
                    usdc_delta: "",
                    status: rc.status === 1 ? "success" : "failed",
                    error: "",
                })
            }
        } catch (e) {
            console.error(`[ERROR] sweeping ETH: ${e?.shortMessage || e?.message}`)
            logCsv({
                time_iso: nowISO(),
                action: "sweepETH",
                termId: "",
                txHash: "",
                eth_before_wei: ethBal.toString(),
                eth_after_wei: ethBal.toString(),
                eth_delta_wei: "0",
                usdc_before: "",
                usdc_after: "",
                usdc_delta: "",
                status: "send_error",
                error: e?.shortMessage || e?.message || "",
            })
        }
    } else {
        console.log("No ETH to sweep.")
    }

    console.log("\nAll done ✅")
    console.log(`CSV written at: ${csvPath}`)
}

main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
