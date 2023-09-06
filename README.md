# Takaturn Diamond migration

+ [Walkthrough](#rocket-walkthrough)
    + [env](#rocket-env)
+ [Deploy test and coverage](#dart-deploy-test-and-coverage)
     
## :rocket: Walkthrough 

1. Clone this repo.
3. Install the dependencies with  `yarn install`.
    + Be sure to not remove the yarn.lock file for a clean installation
4. Create an .env file with the variables explained on the next section

[top](#takaturn-diamond-migration)

### :rocket: env

1. Private keys. For development purposes three can be the same
    + DEPLOYER_PK
    + ARBITRUM_MAINNET_DEPLOYER_PK
    + TESTNET_DEPLOYER_PK
2. Deployers address. Address of the private keys above
    + DEPLOYER_ADDRESS
    + TESTNET_DEPLOYER_ADDRESS
3. Mainnet RPC URL. For the development process it was tooked from [here](https://www.alchemy.com/)
    + ARBITRUM_MAINNET_RPC_URL
4. Testnet RPC_URL. For the development process it was tooked from [here](https://www.alchemy.com/)
 + ARBITRUM_TESTNET_RPC_URL=
5. Scans api keys. [here](https://docs.arbiscan.io/getting-started/viewing-api-usage-statistics) is the process for etherscan.
    + ARBISCAN_API_KEY
6. Price feeds api keys. You can get it [here](https://coinmarketcap.com/api/)
    + COINMARKETCAP_API_KEY=
7. Ethernal
    + ETHERNAL_EMAIL= ammar@zaynfi.com
    + ETHERNAL_PASSWORD=
    + ETHERNAL_API_KEY=
7. Features. Especial features for tests
    + FORK= true to fork arbitrum mainnet. Most of the tests require this to be set to true
    + GAS_REPORT= true to get gas report on the output file
    + SIZE= true to get contract's size report when compile
    + ZAYN= true to disable zaynfi's features



[top](#takaturn-diamond-migration)

## :dart: Deploy test and coverage

There are some scripts set on the package.json file. Check them out

1. Compile
    + `yarn compile`. Compile contracts
2. Tests 
    + `yarn test`. Run all unit tests, some tests run without fork, so you will have to set the .env variable FORK to false
    + `yarn test:staging`. Run tests on the deployed contract on arbitrum goerli testnet
    + `yarn coverage`. Check the test coverage
3. Deploy
    + `yarn deploy`. Run all deploy scripts on local
    + `yarn deploy:local`. Deploy version 1 on local
    + `yarn deploy:mainnet`. Deploy version 1 on arbitrum one
    + `yarn deploy:goerli`. Deploy version 1 on arbitrum goerli
    + `yarn upgrade:local`. Upgrades to version 2 on local
    + `yarn upgrade:mainnet`. Upgrades to version 2 on mainnet
    + `yarn upgrade:goerli`. Upgrades to version 2 on goerli
    + `yarn n` You can also run a node to interact with the deployed contracts


[top](#takaturn-diamond-migration)
