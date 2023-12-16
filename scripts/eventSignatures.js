const { id } = require("ethers")
const { abi } = require("../deployments/mainnet_arbitrum/TakaturnDiamond.json")

async function eventSignatures() {
    const eventNames = abi.filter((item) => item.type === "event").map((item) => item.name)

    const eventSignatures2 = abi
        .filter((item) => item.type === "event")
        .map((item) => `${item.name}(${item.inputs.map((i) => `${i.type}`).join(",")})`)

    for (let i = 0; i < eventNames.length; i++) {
        console.log(`Event: ${eventNames[i]}, Signature Hash: ${id(eventSignatures2[i])}`)
        console.log("=====================================================")
        console.log("")
    }
}

eventSignatures()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
