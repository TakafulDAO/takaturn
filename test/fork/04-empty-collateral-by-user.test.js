const { assert, expect } = require("chai")
const { network, ethers } = require("hardhat")
const { isMainnet, isFork, networkConfig } = require("../../utils/_networks")
const { impersonateAccount } = require("../../utils/_helpers")
const { hour, day } = require("../../utils/units")
const { abi } = require("../../deployments/mainnet_arbitrum/TakaturnDiamond.json")

!isFork || isMainnet
    ? describe.skip
    : describe("Fork Tests. Empty Collaterals", function () {
          const chainId = network.config.chainId

          const salehAddress = "0xb539DB3dFFD0C3f52170a646c720fF2F1fE63623"
          const mirzaAddress = "0x12abCef980483e9CbE62d599C580F400EB750b62"
          const abdurahmanAddress = "0x9b1B0196537959c7454CB2b29f7dc0a630CAb48D"
          const hadjarAddress = "0xCBC831765Eb7d30478A086b3052a9E6895f84D10"
          const yasirAddress = "0x075e626b8b3CB3c6ef5c1Bd10799e5fEA2D66be3"
          const ibnAddress = "0x77e90519Cd988D74849CC7Ea1C568ce7E8db568c"
          const ameerahAddress = "0x7EFEcC88D7431192A9158FF891fB2eD061235D0F"
          const tedjAddress = "0xD65e219994169233E2D1BD19f1771dE743952917"
          const hiangAddress = "0xAD673bB78a3B79A53f742cb9Bb81BaB901Cd0F3C"
          const abdallahAddress = "0x887A64B3645883ae9eb8b9A25CebFD53e613C596"
          const amaniAddress = "0x54CEA3E973E0391Ec6852d0D04fDA7d498e9d7F2"
          const ahdAddress = "0x69fd73E128B451713aC0043B978C3C9640Fe5743"
          const yisaacAddress = "0x4A9c094d2043827371595Da54BA7efA1bCC55214"
          const nejatAddress = "0xa390F13921177B469fFD822CE75a2c0EC562aa5a"
          const abdullahAddress = "0x5d97692C678DB7c369dD0378B13776A7389e7090"
          const hindAddress = "0x029Ec781ca14174DB264Fa391394d97878a070E2"
          const fahdAddress = "0x414e02aFb131a2FfD546b7bF470BCd089ea4d755"
          const khadijaAddress = "0x0a0dABffe6ADB6217CC491440C1b21723921d96c"
          const morradAddress = "0xA253ABb03A060b2C170ead2772D3171Cae484643"
          const ummiAddress = "0x530904F8C6bFdD97AB5f92FD097333F2096D8063"
          const achrafAddress = "0x0842dBada2c5B36724d03F9f3077c64430D46B24"
          const judyAddress = "0x773D44a5F9FF345440565B26526E7b89c03f5418"
          const oxAddress = "0x522F0f1e629CF42e3068de21aB2bCc54f96b0AbA"
          const sophiaAddress = "0x8714B90579AbbE5247FE0Be47Fd35aF72eC87fA5"

          let diamondOwnerAddress, diamondOwnerSigner, diamondOwner

          before(async () => {
              // Mine a block to ensure state is up to date and forking works correctly
              await network.provider.send("hardhat_mine", ["0x1"])
          })

          beforeEach(async () => {
              // Get the contract instances
              const takaturnDiamondAddress = networkConfig[chainId]["takaturnDiamond"]

              takaturnDiamond = await ethers.getContractAt(abi, takaturnDiamondAddress)

              diamondOwnerAddress = await takaturnDiamond.owner()

              await impersonateAccount(diamondOwnerAddress)
              diamondOwnerSigner = await ethers.getSigner(diamondOwnerAddress)
              diamondOwner = takaturnDiamond.connect(diamondOwnerSigner)

              // Top up the diamond owner with some ETH to be able to pay for gas
              const newBalance = ethers.parseEther("1")
              await network.provider.send("hardhat_setBalance", [
                  diamondOwnerAddress,
                  ethers.toBeHex(newBalance),
              ])
          })

          it.only("Empty collateral by user", async () => {
              // Owner balance before emptying collaterals
              const ownerBalanceBefore = await ethers.provider.getBalance(diamondOwnerAddress)
              console.log(
                  `Diamond owner balance before emptying collaterals: ${ethers.formatEther(
                      ownerBalanceBefore
                  )} ETH`
              )

              let ownerBalanceAfter
              let tx
              let incoming
              let totalDiffWei = 0n
              let lastOwnerBalance = ownerBalanceBefore

              // Fetch all ETH balance before emptying collateral
              console.log("Fetching participants' ETH balances before emptying collateral...")
              const participants = [
                  { name: "Saleh", address: salehAddress },
                  { name: "Mirza", address: mirzaAddress },
                  { name: "Abdurahman", address: abdurahmanAddress },
                  { name: "Hadjar", address: hadjarAddress },
                  { name: "Yasir", address: yasirAddress },
                  { name: "Ibn", address: ibnAddress },
                  { name: "Ameerah", address: ameerahAddress },
                  { name: "Tedj", address: tedjAddress },
                  { name: "Hiang", address: hiangAddress },
                  { name: "Abdallah", address: abdallahAddress },
                  { name: "Amani", address: amaniAddress },
                  { name: "Ahd", address: ahdAddress },
                  { name: "Yisaac", address: yisaacAddress },
                  { name: "Nejat", address: nejatAddress },
                  { name: "Abdullah", address: abdullahAddress },
                  { name: "Hind", address: hindAddress },
                  { name: "Fahd", address: fahdAddress },
                  { name: "Khadija", address: khadijaAddress },
                  { name: "Ummi", address: ummiAddress },
                  { name: "Morrad", address: morradAddress },
                  { name: "Achraf", address: achrafAddress },
                  { name: "Judy", address: judyAddress },
                  { name: "Ox", address: oxAddress },
                  { name: "Sophia", address: sophiaAddress },
              ]

              const balancesBefore = []
              for (const p of participants) {
                  balancesBefore.push({
                      name: p.name,
                      address: p.address,
                      balance_wei: await ethers.provider.getBalance(p.address),
                      balance_eth: ethers.formatEther(await ethers.provider.getBalance(p.address)),
                  })
              }

              console.table(balancesBefore)

              // Saleh on term 14
              await diamondOwner.emptyCollateralAfterEnd(14n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: salehAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Mirza on term 18
              await diamondOwner.emptyCollateralAfterEnd(18n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: mirzaAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Abdurahman on term 19
              await diamondOwner.emptyCollateralAfterEnd(19n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: abdurahmanAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Hadjar on term 29
              await diamondOwner.emptyCollateralAfterEnd(29n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: hadjarAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Yasir on term 30
              await diamondOwner.emptyCollateralAfterEnd(30n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: yasirAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Ibn on term 31
              await diamondOwner.emptyCollateralAfterEnd(31n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: ibnAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Ammerah on term 33
              await diamondOwner.emptyCollateralByUser(33n, ameerahAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: ameerahAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Tedj on term 33
              await diamondOwner.emptyCollateralByUser(33n, tedjAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: tedjAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Hiang on term 47
              await diamondOwner.emptyCollateralAfterEnd(47n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: hiangAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Abdallah on term 48
              await diamondOwner.emptyCollateralByUser(48n, abdallahAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: abdallahAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              //   Amani on term 48
              await diamondOwner.emptyCollateralByUser(48n, amaniAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: amaniAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Ahd on term 51
              await diamondOwner.emptyCollateralByUser(51n, ahdAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: ahdAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Abdallah on term 51
              await diamondOwner.emptyCollateralByUser(51n, abdallahAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: abdallahAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Yisaac on term 52
              await diamondOwner.emptyCollateralByUser(52n, yisaacAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: yisaacAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Hiang on term 52
              await diamondOwner.emptyCollateralByUser(52n, hiangAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: hiangAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Nejat on term 53
              await diamondOwner.emptyCollateralAfterEnd(53n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: nejatAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Yisaac on term 67
              await diamondOwner.emptyCollateralAfterEnd(67n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: yisaacAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Abdullah on term 71
              await diamondOwner.emptyCollateralAfterEnd(71n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: abdullahAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Abdallah on term 75
              await diamondOwner.emptyCollateralAfterEnd(75n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: abdallahAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Hind on term 81
              await diamondOwner.emptyCollateralAfterEnd(81n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: hindAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Fahd on term 99
              await diamondOwner.emptyCollateralAfterEnd(99n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: fahdAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Fahd on term 100
              await diamondOwner.emptyCollateralByUser(100n, fahdAddress)
              await diamondOwner.emptyCollateralAfterEnd(100n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: fahdAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              //   Khadija on term 105
              await diamondOwner.emptyCollateralAfterEnd(105n)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: khadijaAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Morrad on term 110
              await diamondOwner.emptyCollateralByUser(110n, morradAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: morradAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Ummi on term 110
              await diamondOwner.emptyCollateralByUser(110n, ummiAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: ummiAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              //   //   // Achraf on term 116
              await diamondOwner.emptyCollateralByUser(116n, achrafAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: achrafAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              //   Judy on term 116
              await diamondOwner.emptyCollateralByUser(116n, judyAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: judyAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // 0x on term 116
              await diamondOwner.emptyCollateralByUser(116n, oxAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: oxAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Ummi on term 116
              await diamondOwner.emptyCollateralByUser(116n, ummiAddress)

              ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              incoming = ownerBalanceAfter - ownerBalanceBefore
              totalDiffWei += incoming

              if (incoming < 0n) {
                  incoming = 0n
                  console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              } else {
                  tx = await diamondOwnerSigner.sendTransaction({
                      to: ummiAddress,
                      value: incoming,
                  })
                  await tx.wait()
              }

              // Sophia on term 121
              //   await diamondOwner.emptyCollateralByUser(121n, sophiaAddress)
              //   await diamondOwner.emptyCollateralAfterEnd(121n)

              //   ownerBalanceAfter = await ethers.provider.getBalance(diamondOwnerAddress)
              //   incoming = ownerBalanceAfter - ownerBalanceBefore
              //   totalDiffWei += incoming

              //   if (incoming < 0n) {
              //       incoming = 0n
              //       console.log("⚠️⚠️⚠️ Warning: Received 0 ETH from emptying collaterals. ⚠️⚠️⚠️")
              //   } else {
              //       tx = await diamondOwnerSigner.sendTransaction({
              //           to: sophiaAddress,
              //           value: incoming,
              //       })
              //       await tx.wait()
              //   }

              // Fetch all ETH balance after emptying collateral
              console.log("Fetching participants' ETH balances after emptying collateral...")
              const balancesAfter = []
              for (const p of participants) {
                  const balance = await ethers.provider.getBalance(p.address)
                  balancesAfter.push({
                      name: p.name,
                      address: p.address,
                      balance_wei: await ethers.provider.getBalance(p.address),
                      balance_eth: ethers.formatEther(await ethers.provider.getBalance(p.address)),
                  })
              }

              console.table(balancesAfter)

              console.log("Balance differences after emptying collaterals:")
              // Difference table
              const balancesDiff = []
              for (let i = 0; i < participants.length; i++) {
                  let differenceWei = balancesAfter[i].balance_wei - balancesBefore[i].balance_wei
                  balancesDiff.push({
                      name: participants[i].name,
                      address: participants[i].address,
                      difference_wei: differenceWei,
                      difference_eth: ethers.formatEther(differenceWei),
                  })
              }
              console.table(balancesDiff)
              console.log(`Total ETH emptied as collateral (wei): ${totalDiffWei}`)
              console.log(
                  `Total ETH emptied as collateral (eth): ${ethers.formatEther(totalDiffWei)}`
              )

              console.log("Emptying collaterals by user done.")
          })
      })
