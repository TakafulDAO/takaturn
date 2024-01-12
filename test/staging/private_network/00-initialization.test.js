const { assert } = require("chai")
const { ethers } = require("hardhat")
const { isInternal, networkConfig } = require("../../../utils/_networks")

!isInternal
    ? describe.skip
    : describe("Staging Private Network Tests. Initialization [ @initialization ]", function () {
          const chainId = network.config.chainId
          let deployer, takaturn

          console.log(
              "Be aware that this tests are calling the blockchain and can take a while to finish."
          )
          console.log("Please be patient...")
          console.log(
              "=================================================================================="
          )

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer

              takaturn = await ethers.getContract("TakaturnDiamond", deployer)

              strategy = await ethers.getContract("StrategyV2Mock", deployer)
              vault = await ethers.getContract("ZaynVaultV2TakaDAO", deployer)
              zap = await ethers.getContract("ZaynZapV2TakaDAOMock", deployer)
          })

          describe("Initialization variables", function () {
              describe("Takaturn", function () {
                  it("Should return the right deployer", async function () {
                      const expectedDeployer = deployer
                      const currentDeployer = await takaturn.owner()
                      assert.equal(expectedDeployer, currentDeployer)
                  })
                  it("Should return the right lock value", async function () {
                      const lock = await takaturn.getYieldLockState()
                      assert.ok(!lock)
                  })
                  it("Should return the right value for the ETH/USD Chainlink price feed", async function () {
                      const deployConstants = await takaturn.getConstants(
                          "ETH/USD",
                          "USDC/USD",
                          "ZaynZap",
                          "ZaynVault"
                      )

                      assert.equal(
                          deployConstants[0].toLowerCase(),
                          networkConfig[chainId]["ethUsdPriceFeed"].toLowerCase()
                      )
                  })
                  it("Should return the right value for the USDC/USD Chainlink price feed", async function () {
                      const deployConstants = await takaturn.getConstants(
                          "ETH/USD",
                          "USDC/USD",
                          "ZaynZap",
                          "ZaynVault"
                      )

                      assert.equal(
                          deployConstants[1].toLowerCase(),
                          networkConfig[chainId]["usdcUsdPriceFeed"].toLowerCase()
                      )
                  })
                  it("Should return the right value for the ZaynFi Zap contract", async function () {
                      const deployConstants = await takaturn.getConstants(
                          "ETH/USD",
                          "USDC/USD",
                          "ZaynZap",
                          "ZaynVault"
                      )

                      assert.equal(
                          deployConstants[2].toLowerCase(),
                          networkConfig[chainId]["zaynfiZap"].toLowerCase()
                      )
                  })
                  it("Should return the right value for the ZaynFi Vault contract", async function () {
                      const deployConstants = await takaturn.getConstants(
                          "ETH/USD",
                          "USDC/USD",
                          "ZaynZap",
                          "ZaynVault"
                      )
                      assert.equal(
                          deployConstants[3].toLowerCase(),
                          networkConfig[chainId]["zaynfiVault"].toLowerCase()
                      )
                  })
              })
              describe("ZaynFi", function () {
                  it("Should return the right vault on the strategy", async function () {
                      const expectedAddress = vault.target
                      const currentAddres = await strategy.vault()
                      assert.equal(expectedAddress, currentAddres)
                  })
                  it("Should return the right zap on the vault", async function () {
                      const expectedAddress = zap.target
                      const currentAddres = await vault.zapAddress()
                      assert.equal(expectedAddress, currentAddres)
                  })
                  it("The takaturn contract should be allowed by the zap", async function () {
                      const trusted = await zap.trustedSenders(takaturn)
                      assert.ok(trusted)
                  })
              })
          })
      })
