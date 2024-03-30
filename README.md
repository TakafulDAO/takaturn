# Takaturn V2 Smart Contracts 
Takaturn is an interest-free, community-based credit platform that helps crypto users get together, save together, and earn yield on their locked collateral together. 

Once you start saving with a Term group, defaulting on a payment means the payment is taken from your collateral. Finishing the a Term group means you are done borrowing and paying back the total amount. 

+ [Resources](#resources)
+ [Deployed Contracts](#deployed-contracts)
+ [Walkthrough](#walkthrough)
+ [Deploy test and coverage](#deploy-test-and-coverage)
+ [Contribute](#contribute)
     
## Resources 
* White Paper: https://takadao.gitbook.io/takaturn-2.0
* Shariah Paper: https://takadao.gitbook.io/takaturn-shariahpaper 
* Technical Documentation: https://takadao.gitbook.io/takaturn-2.0-smart-contract-documentation/
* Louper Dev Diamond Explorer: https://louper.dev/diamond/0x00042e3895f5ef16b96bc904b9acc92509624ea2?network=arbitrum
* Audit Report: https://drive.google.com/file/d/1TjPY_dMNdzHD9qUpyZX-wcjpojGcUMl9/view?usp=sharing

## Deployed Contracts
Takaturn operates on Arbitrum.  
* Arbitrum Mainnet: 0x00042e3895f5ef16b96bc904b9acc92509624ea2 [View on Arbiscan](https://arbiscan.io/address/0x00042e3895f5ef16b96bc904b9acc92509624ea2)
* Arbitrum Goerli: 0x9FBDb4A7E0fe9EA27148Dcd165a61AFEF4fAFf89 [View on Arbiscan Testnet](https://testnet.arbiscan.io/address/0x9FBDb4A7E0fe9EA27148Dcd165a61AFEF4fAFf89)
* Arbitrum Sepolia: 0x9FBDb4A7E0fe9EA27148Dcd165a61AFEF4fAFf89 [View on Arbiscan Testnet](https://sepolia.arbiscan.io/address/0x9fbdb4a7e0fe9ea27148dcd165a61afef4faff89)

Takaturn relies on smart contracts deployed by [Zaynfi](https://zayn.fi/) for Yield Generation.
* Vault: 0xE68F590a735Ec00eD292AC9849aFfcC2D8B50aF1 
* Strategy: 0x5da006dEA0B1F132b81370d3F51B721252b7e7bB 
* Zap V2: 0x1534c33FF68cFF9E0c5BABEe5bE72bf4cad0826b

## Version Control 
To view the testnet and mainnet deployments, check out the tags under this repo. The tag naming convention follows [Semantic Versioning](https://semver.org/)
* Deployment versions start from v2.0.0 to indicate Takaturn V2.
* Tags related to testnet start with dev. Ex. dev2.0.0

## Walkthrough
1. Clone this repo.
3. Install the dependencies with  `yarn install`.
    + Be sure to not remove the yarn.lock file for a clean installation
4. Create a .env file with the variables explained on the next section. You can also check the `.env.example` file
5. As package manager it was used yarn

### env
1. Private keys. For development purposes, this three private keys can be the same
    + DEPLOYER_PK
    + ARBITRUM_MAINNET_DEPLOYER_PK
    + TESTNET_DEPLOYER_PK
2. Deployers address. Address of the private keys above. As explained before for development purposes, this addresses can be the same
    + DEPLOYER_ADDRESS
    + TESTNET_DEPLOYER_ADDRESS
3. Mainnet RPC URL
    + ARBITRUM_MAINNET_RPC_URL
4. Testnet RPC_URL
 + ARBITRUM_TESTNET_GOERLI_RPC_URL
 + ARBITRUM_TESTNET_SEPOLIA_RPC_URL
5. Scans api keys. [here](https://docs.arbiscan.io/getting-started/viewing-api-usage-statistics)
    + ARBISCAN_API_KEY
6. Price feeds api keys. You can get it [here](https://coinmarketcap.com/api/)
    + COINMARKETCAP_API_KEY=
7. Features. Especial features for tests
    + FORK= true to fork arbitrum mainnet. Most of the tests require this to be set to true
    + GAS_REPORT= true to get gas report on the output file
    + SIZE= true to get contract's size report when compile

> [!CAUTION]
> Never expose private keys with real funds
    
## Deploy, Test and Coverage
There are some scripts set on the package.json file. Check them out

1. Compile
    + `yarn compile`. Compile contracts
2. Tests 
    + `yarn test`. Run all unit tests, some tests run without fork, so you will have to set the .env variable FORK to false
    + `yarn coverage`. Check the test coverage
3. Deploy
    + `yarn deploy`. Run all deploy scripts on local
    + Check every script for deploy on the desired network
    + To deploy on private networks:
        + Add the rpc to the .env
        + Run `yarn deploy:takadao:mocks`
        + Take the addresses of the recently deployed contracts from the deployments directory
        + Paste this addresses on the directory ~utils/_networks.js in the corresponding chain id
        + Run `yarn deploy:takadao`
        + Take the address of the recently deployed diamond from the deployments directory
        + Paste this address on the _networks file in the corresponding chain id
        + Now the staging tests can be made

> [!IMPORTANT]
> private_network staging tests have this order @initialization, @create-and-join, @start, @pay, @close, @new-cycle

## Contribute 
Contribute by creating a gas optimization or no risk issue through github issues. 
Contribute by sending critical issues/ vulnerabilities to info@takadao.io. 

[top](#takaturn-v2-smart-contracts)


