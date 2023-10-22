const { assert, expect } = require("chai")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { network, ethers } = require("hardhat")
const { advanceTime, impersonateAccount } = require("../../../utils/_helpers")
const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    registrationPeriod,
} = require("../utils/test-utils")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe.only("End to end test", function () {
          const chainId = network.config.chainId

          let takaturnDiamond, aggregator, usdc, zaynZap

          let deployer,
              participant_1,
              participant_2,
              participant_3,
              participant_4,
              participant_5,
              participant_6,
              participant_7,
              participant_8,
              participant_9,
              participant_10,
              participant_11,
              participant_12
          beforeEach(async function () {
              // Get the accounts
              accounts = await ethers.getSigners()

              // accounts used:
              // 0: deployer
              // 1 - 12: participants

              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]
              participant_4 = accounts[4]
              participant_5 = accounts[5]
              participant_6 = accounts[6]
              participant_7 = accounts[7]
              participant_8 = accounts[8]
              participant_9 = accounts[9]
              participant_10 = accounts[10]
              participant_11 = accounts[11]
              participant_12 = accounts[12]

              // Deploy contract
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              aggregator = await ethers.getContract("MockEthUsdAggregator")

              // Get contract instances

              const usdcAddress = networkConfig[chainId]["usdc"]
              const zaynZapAddress = networkConfig[chainId]["zaynfiZap"]

              usdc = await ethers.getContractAt(
                  "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                  usdcAddress
              )
              zaynZap = await ethers.getContractAt(
                  "contracts/interfaces/IZaynZapV2TakaDAO.sol:IZaynZapV2TakaDAO",
                  zaynZapAddress
              )

              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)

              const zapOwner = "0xff0C52AfD43CeCA4c5E674f61fa93BE32647f185"
              const usdcWhale = networkConfig[chainId]["usdcWhale"]

              await impersonateAccount(zapOwner)
              await impersonateAccount(usdcWhale)

              const zapOwnerSigner = await ethers.getSigner(zapOwner)
              const whale = await ethers.getSigner(usdcWhale)

              zaynZapOwner = zaynZap.connect(zapOwnerSigner)
              usdcWhaleSigner = usdc.connect(whale)

              await zaynZapOwner.toggleTrustedSender(takaturnDiamond.address, true, {
                  gasLimit: 1000000,
              })

              let userAddress
              for (let i = 1; i <= totalParticipants; i++) {
                  userAddress = accounts[i].address
                  await usdcWhaleSigner.transfer(userAddress, contributionAmount * 10 ** 6)

                  await usdc
                      .connect(accounts[i])
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
              }
          })
      })
