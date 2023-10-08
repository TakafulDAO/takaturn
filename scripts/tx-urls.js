const { gql } = require("graphql-tag")
const { GraphQLClient } = require("graphql-request")

const client = new GraphQLClient(
    "https://api.studio.thegraph.com/query/33833/takaturn-diamond/version/latest"
)
// ? Emitted already
// OnCollateralLiquidated Event Transaction URLs ordered by term Ids:
const queryCollateralLiquidatedEvent = async () => {
    const queryString = `
          query  {
              onCollateralLiquidateds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const collateralLiquidated = await client.request(gql(queryString))

    return collateralLiquidated
}

;(async () => {
    const tx = await queryCollateralLiquidatedEvent()
    if (tx.onCollateralLiquidateds.length === 0) {
        console.log("No OnCollateralLiquidated Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnCollateralLiquidated Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onCollateralLiquidateds.length; i++) {
        console.log(`termId: ${tx.onCollateralLiquidateds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onCollateralLiquidateds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnCollateralStateChanged Event Transaction URLs ordered by term Ids:
const queryCollateralStateChangedEvent = async () => {
    const queryString = `
          query  {
              onCollateralStateChangeds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const collateralStateChanged = await client.request(gql(queryString))

    return collateralStateChanged
}

;(async () => {
    const tx = await queryCollateralStateChangedEvent()
    if (tx.onCollateralStateChangeds.length === 0) {
        console.log("No OnCollateralStateChanged Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnCollateralStateChanged Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onCollateralStateChangeds.length; i++) {
        console.log(`termId: ${tx.onCollateralStateChangeds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onCollateralStateChangeds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ! Not emitted yet
// OnCollateralWithdrawal Event Transaction URLs ordered by term Ids:
const queryCollateralWithdrawalEvent = async () => {
    const queryString = `
          query  {
              onCollateralWithdrawals (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const collateralWithdrawal = await client.request(gql(queryString))

    return collateralWithdrawal
}

;(async () => {
    const tx = await queryCollateralWithdrawalEvent()
    if (tx.onCollateralWithdrawals.length === 0) {
        console.log("No OnCollateralWithdrawal Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnCollateralWithdrawal Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onCollateralWithdrawals.length; i++) {
        console.log(`termId: ${tx.onCollateralWithdrawals[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onCollateralWithdrawals[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnFrozenMoneyPotLiquidated Event Transaction URLs ordered by term Ids:
const queryFrozenMoneyPotLiquidatedEvent = async () => {
    const queryString = `
          query  {
              onFrozenMoneyPotLiquidateds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const frozenMoneyPotLiquidated = await client.request(gql(queryString))

    return frozenMoneyPotLiquidated
}

;(async () => {
    const tx = await queryFrozenMoneyPotLiquidatedEvent()
    if (tx.onFrozenMoneyPotLiquidateds.length === 0) {
        console.log("No OnFrozenMoneyPotLiquidated Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnFrozenMoneyPotLiquidated Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onFrozenMoneyPotLiquidateds.length; i++) {
        console.log(`termId: ${tx.onFrozenMoneyPotLiquidateds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onFrozenMoneyPotLiquidateds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnReimbursementWithdrawn Event Transaction URLs ordered by term Ids:
const queryReimbursementWithdrawnEvent = async () => {
    const queryString = `
          query  {
              onReimbursementWithdrawns (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const reimbursementWithdrawn = await client.request(gql(queryString))

    return reimbursementWithdrawn
}

;(async () => {
    const tx = await queryReimbursementWithdrawnEvent()
    if (tx.onReimbursementWithdrawns.length === 0) {
        console.log("No OnReimbursementWithdrawn Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnReimbursementWithdrawn Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onReimbursementWithdrawns.length; i++) {
        console.log(`termId: ${tx.onReimbursementWithdrawns[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onReimbursementWithdrawns[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnAutoPayToggled Event Transaction URLs ordered by term Ids:
const queryAutoPayToggledEvent = async () => {
    const queryString = `
          query  {
              onAutoPayToggleds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const autoPayToggled = await client.request(gql(queryString))

    return autoPayToggled
}

;(async () => {
    const tx = await queryAutoPayToggledEvent()
    if (tx.onAutoPayToggleds.length === 0) {
        console.log("No OnAutoPayToggled Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnAutoPayToggled Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onAutoPayToggleds.length; i++) {
        console.log(`termId: ${tx.onAutoPayToggleds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onAutoPayToggleds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnBeneficiaryAwarded Event Transaction URLs ordered by term Ids:
const queryBeneficiaryAwardedEvent = async () => {
    const queryString = `
          query  {
              onBeneficiaryAwardeds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const beneficiaryAwarded = await client.request(gql(queryString))

    return beneficiaryAwarded
}

;(async () => {
    const tx = await queryBeneficiaryAwardedEvent()
    if (tx.onBeneficiaryAwardeds.length === 0) {
        console.log("No OnBeneficiaryAwarded Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnBeneficiaryAwarded Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onBeneficiaryAwardeds.length; i++) {
        console.log(`termId: ${tx.onBeneficiaryAwardeds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onBeneficiaryAwardeds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnDefaulterExpelled Event Transaction URLs ordered by term Ids:
const queryDefaulterExpelledEvent = async () => {
    const queryString = `
          query  {
              onDefaulterExpelleds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const defaulterExpelled = await client.request(gql(queryString))

    return defaulterExpelled
}

;(async () => {
    const tx = await queryDefaulterExpelledEvent()
    if (tx.onDefaulterExpelleds.length === 0) {
        console.log("No OnDefaulterExpelled Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnDefaulterExpelled Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onDefaulterExpelleds.length; i++) {
        console.log(`termId: ${tx.onDefaulterExpelleds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onDefaulterExpelleds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnFundStateChanged Event Transaction URLs ordered by term Ids:
const queryFundStateChangedEvent = async () => {
    const queryString = `
          query  {
              onFundStateChangeds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const fundStateChanged = await client.request(gql(queryString))

    return fundStateChanged
}

;(async () => {
    const tx = await queryFundStateChangedEvent()
    if (tx.onFundStateChangeds.length === 0) {
        console.log("No OnFundStateChanged Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnFundStateChanged Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onFundStateChangeds.length; i++) {
        console.log(`termId: ${tx.onFundStateChangeds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onFundStateChangeds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnFundWithdrawn Event Transaction URLs ordered by term Ids:
const queryFundWithdrawnEvent = async () => {
    const queryString = `
          query  {
              onFundWithdrawns (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const fundWithdrawn = await client.request(gql(queryString))

    return fundWithdrawn
}

;(async () => {
    const tx = await queryFundWithdrawnEvent()
    if (tx.onFundWithdrawns.length === 0) {
        console.log("No OnFundWithdrawn Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnFundWithdrawn Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onFundWithdrawns.length; i++) {
        console.log(`termId: ${tx.onFundWithdrawns[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onFundWithdrawns[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnPaidContribution Event Transaction URLs ordered by term Ids:
const queryPaidContributionEvent = async () => {
    const queryString = `
          query  {
              onPaidContributions (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const paidContribution = await client.request(gql(queryString))

    return paidContribution
}

;(async () => {
    const tx = await queryPaidContributionEvent()
    if (tx.onPaidContributions.length === 0) {
        console.log("No OnPaidContribution Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnPaidContribution Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onPaidContributions.length; i++) {
        console.log(`termId: ${tx.onPaidContributions[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onPaidContributions[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnParticipantDefaulted Event Transaction URLs ordered by term Ids:
const queryParticipantDefaultedEvent = async () => {
    const queryString = `
          query  {
              onParticipantDefaulteds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const participantDefaulted = await client.request(gql(queryString))

    return participantDefaulted
}

;(async () => {
    const tx = await queryParticipantDefaultedEvent()
    if (tx.onParticipantDefaulteds.length === 0) {
        console.log("No OnParticipantDefaulted Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnParticipantDefaulted Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onParticipantDefaulteds.length; i++) {
        console.log(`termId: ${tx.onParticipantDefaulteds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onParticipantDefaulteds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnTermStart Event Transaction URLs ordered by term Ids:
const queryTermStartEvent = async () => {
    const queryString = `
          query  {
              onTermStarts (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const termStart = await client.request(gql(queryString))

    return termStart
}

;(async () => {
    const tx = await queryTermStartEvent()
    if (tx.onTermStarts.length === 0) {
        console.log("No OnTermStart Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnTermStart Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onTermStarts.length; i++) {
        console.log(`termId: ${tx.onTermStarts[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onTermStarts[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnCollateralDeposited Event Transaction URLs ordered by term Ids:
const queryCollateralDepositedEvent = async () => {
    const queryString = `
          query  {
              onCollateralDepositeds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const collateralDeposited = await client.request(gql(queryString))

    return collateralDeposited
}

;(async () => {
    const tx = await queryCollateralDepositedEvent()
    if (tx.onCollateralDepositeds.length === 0) {
        console.log("No OnCollateralDeposited Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnCollateralDeposited Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onCollateralDepositeds.length; i++) {
        console.log(`termId: ${tx.onCollateralDepositeds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onCollateralDepositeds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnTermCreated Event Transaction URLs ordered by term Ids:
const queryTermCreatedEvent = async () => {
    const queryString = `
          query  {
              onTermCreateds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const termCreated = await client.request(gql(queryString))

    return termCreated
}

;(async () => {
    const tx = await queryTermCreatedEvent()
    if (tx.onTermCreateds.length === 0) {
        console.log("No OnTermCreated Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnTermCreated Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onTermCreateds.length; i++) {
        console.log(`termId: ${tx.onTermCreateds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onTermCreateds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnTermExpired Event Transaction URLs ordered by term Ids:
const queryTermExpiredEvent = async () => {
    const queryString = `
          query  {
              onTermExpireds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const termExpired = await client.request(gql(queryString))

    return termExpired
}

;(async () => {
    const tx = await queryTermExpiredEvent()
    if (tx.onTermExpireds.length === 0) {
        console.log("No OnTermExpired Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnTermExpired Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onTermExpireds.length; i++) {
        console.log(`termId: ${tx.onTermExpireds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onTermExpireds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnTermFilled Event Transaction URLs ordered by term Ids:
const queryTermFilledEvent = async () => {
    const queryString = `
          query  {
              onTermFilleds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const termFilled = await client.request(gql(queryString))

    return termFilled
}

;(async () => {
    const tx = await queryTermFilledEvent()
    if (tx.onTermFilleds.length === 0) {
        console.log("No OnTermFilled Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnTermFilled Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onTermFilleds.length; i++) {
        console.log(`termId: ${tx.onTermFilleds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onTermFilleds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ? Emitted already
// OnYGOptInToggled Event Transaction URLs ordered by term Ids:
const queryYGOptInToggled = async () => {
    const queryString = `
          query  {
              onYGOptInToggleds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const YGOptInToggled = await client.request(gql(queryString))

    return YGOptInToggled
}

;(async () => {
    const tx = await queryYGOptInToggled()
    if (tx.onYGOptInToggleds.length === 0) {
        console.log("No OnYGOptInToggled Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnYGOptInToggled Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onYGOptInToggleds.length; i++) {
        console.log(`termId: ${tx.onYGOptInToggleds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onYGOptInToggleds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
// ! Not emitted yet
// OnYieldClaimed Event Transaction URLs ordered by term Ids:
const queryYieldClaimed = async () => {
    const queryString = `
          query  {
              onYieldClaimeds (orderBy: termId orderDirection: desc) {
                termId
                transactionHash
              }
          }`
    const yieldClaimed = await client.request(gql(queryString))

    return yieldClaimed
}

;(async () => {
    const tx = await queryYieldClaimed()
    if (tx.onYieldClaimeds.length === 0) {
        console.log("No OnYieldClaimed Event emitted yet from the smart contract")
        console.log(
            "=============================================================================="
        )
        console.log(
            "=============================================================================="
        )
        return
    }
    console.log("OnYieldClaimed Event Transaction URLs ordered by term Ids:")
    for (let i = 0; i < tx.onYieldClaimeds.length; i++) {
        console.log(`termId: ${tx.onYieldClaimeds[i].termId}`)
        const transactionUrl = `https://goerli.arbiscan.io/tx/${tx.onYieldClaimeds[i].transactionHash}`
        console.log(transactionUrl)
    }
    console.log("==============================================================================")
    console.log("==============================================================================")
})()
