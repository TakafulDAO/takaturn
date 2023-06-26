const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../../utils/_networks")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Diamond unit tests", function () {
          let takaturnDiamond, takaturnDiamondDeployer, takaturnDiamondDiamondOwner

          beforeEach(async () => {
              // Get the accounts
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              diamondOwner = accounts[5]
              // Deploy contracts
              await deployments.fixture(["diamond_app_storage_deploy"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamondAppStorage")
              // Connect the users
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondDiamondOwner = takaturnDiamond.connect(diamondOwner)
          })

          describe("Initialization", function () {
              it("Should get the init values for the AppStorage", async function () {
                  const expectedNumber = 1
                  const currentNumber = await takaturnDiamond.getNumber()
                  assert.equal(currentNumber.toString(), expectedNumber.toString())
              })
          })

          describe("Testing the new diamond", function () {
              describe("Testing facets that will remain", function () {
                  it("Should call the getNuber function from the Test Facet", async function () {
                      const expectedNumber = 2
                      await takaturnDiamond.saveNumber(expectedNumber)
                      const newNumber = await takaturnDiamond.getNumber()
                      assert.equal(newNumber.toString(), expectedNumber.toString())
                  })
              })
              describe("Testing facet that will be deleted", function () {
                  it("Should call the sayHello function from the Facet to delete", async function () {
                      const newString = "Hello!"
                      const callTx = await takaturnDiamond.sayHello(newString)
                      const expected = "hello : " + "" + newString
                      assert.equal(expected, callTx)
                  })

                  it("Should call the sayHello1 function from the Facet to delete", async function () {
                      const newString = "Hello 1!"
                      const callTx = await takaturnDiamond.sayHello1(newString)
                      const expected = "hello1 : " + "" + newString
                      assert.equal(expected, callTx)
                  })
              })
          })

          describe("Testing the diamond upgrade", function () {
              beforeEach(async () => {
                  await deployments.fixture(["diamond_app_storage_upgrade"])
                  // Need to update the variable so it takes the new ABI
                  takaturnDiamond = await ethers.getContract("TakaturnDiamondAppStorage")
              })
              describe("Testing facets that remained after the upgrade", function () {
                  it("Should call the getNuber function from the Test Facet", async function () {
                      const newNumber = 3
                      await takaturnDiamond.saveNumber(newNumber)
                      const updatedNumber = await takaturnDiamond.getNumber()
                      assert.equal(newNumber.toString(), updatedNumber.toString())
                  })
              })
              describe("Testing new facets after the upgrade", function () {
                  it("Should call the new sayHello function from the new Facet", async function () {
                      const newString = "New hello!"
                      const callTx = await takaturnDiamond.sayHello(newString)
                      const expected = "hello modified : " + "" + newString
                      assert.equal(expected, callTx)
                  })

                  it("Should call the sayHello2 function from the new Facet", async function () {
                      const newString = "Hello 2!"
                      const callTx = await takaturnDiamond.sayHello2(newString)
                      const expected = "hello2 : " + "" + newString
                      assert.equal(expected, callTx)
                  })
              })
              describe("Checking if older functions stil exist", function () {
                  it("Should fail to call the sayHello1 function from the original diamond", async function () {
                      try {
                          const newString = "Hello 1!"
                          await takaturnDiamond.sayHello1(newString)
                          assert.fail("Function exists")
                      } catch (error) {
                          assert.include(
                              error.message,
                              "takaturnDiamond.sayHello1 is not a function"
                          )
                      }
                  })
              })
          })
      })
