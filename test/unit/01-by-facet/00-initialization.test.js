const { assert } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Upgrades Term Facet unit tests", function () {
          const chainId = network.config.chainId

          let takaturnDiamond

          beforeEach(async () => {
              // Get the accounts
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              participant_1 = accounts[1]

              // Deploy contracts
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              if (isDevnet && !isFork) {
                  aggregator = await ethers.getContract("MockEthUsdAggregator")
                  usdc = await ethers.getContract("FiatTokenV2_1")
              } else {
                  // Fork
                  const aggregatorAddress = networkConfig[chainId]["ethUsdPriceFeed"]
                  const usdcAddress = networkConfig[chainId]["usdc"]

                  aggregator = await ethers.getContractAt(
                      "AggregatorV3Interface",
                      aggregatorAddress
                  )
                  usdc = await ethers.getContractAt(
                      // "contracts/version-1/mocks/USDC.sol:IERC20"
                      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                      usdcAddress
                  )
              }
          })

          describe("Initialization variables", function () {
              it("Should return the right init values", async function () {
                  const deployConstants = await takaturnDiamond.getConstants(
                      "ETH/USD",
                      "USDC/USD",
                      "ZaynZap",
                      "ZaynVault"
                  )

                  const lock = await takaturnDiamond.getYieldLockState()
                  assert.ok(lock)
                  assert.equal(
                      deployConstants[0].toLowerCase(),
                      networkConfig[chainId]["ethUsdPriceFeed"].toLowerCase()
                  )
                  assert.equal(
                      deployConstants[1].toLowerCase(),
                      networkConfig[chainId]["usdcUsdPriceFeed"].toLowerCase()
                  )
                  assert.equal(
                      deployConstants[2].toLowerCase(),
                      networkConfig[chainId]["zaynfiZap"].toLowerCase()
                  )
                  assert.equal(
                      deployConstants[3].toLowerCase(),
                      networkConfig[chainId]["zaynfiVault"].toLowerCase()
                  )
              })

              it("Should change the lock state", async function () {
                  await takaturnDiamond.toggleYieldLock()
                  let lock = await takaturnDiamond.getYieldLockState()

                  assert.ok(!lock)

                  await takaturnDiamond.toggleYieldLock()
                  lock = await takaturnDiamond.getYieldLockState()

                  assert.ok(lock)
              })
          })
      })
