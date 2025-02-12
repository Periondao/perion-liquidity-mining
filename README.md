# Perion Liquidity Mining Smart Contracts

This repo contains the smart contracts for Perion's staking program. Perion liquidity mining rewards users who deposit their PERC and PERC/WETH Sushi Swap LP tokens.

## Reward Distribution

Perion DAO will distribute rewards in PERC with 80% of the rewards going to sushi swap LP stakers and 20% going to PERC stakers.

## V2 upgrade

On the 11th of Feb 2025, perion upgraded the contract to v2. V2 includes a function to allow the `ProxyAdmin` owner to refund depositors. This upgrade was performed on both staking pools, and the `ProxyAdmin` owner address was hardcoded to `0x1CFc93ebaA24DA3A314CF35C4d5487348C8F6791` to prevent having to modify any storage. The script used to perform this upgrade can be found in `scripts/Upgrade.ts`.

## Duration

This staking program will go on until the 22nd of January 2026. Users will not be able to stake past this date. Users can stake for a minimum of 1 month and a maximum of 36 months (or until the end date, whichever comes first).

## Multipliers

Users are rewarded proportional to the amount of tokens they stake and the amount of time they wish to lock up their tokens. Users who stake for 3 years will be given the max multiplier of `5x`. The reward multiplier can be calculated using `1x + months / 9 * 36`.

## Functionality

### Deposit

Users deposit either PERC or Sushi Swap LP PERC into the staking contract. This mints them a token representative of their share of the pool. Once you have staked your coins, you are unable to withdraw either the deposit principle or rewards until the duration has passed.

| **Name**    | **Type**  | **Description**                                              |
| ----------- | --------- | ------------------------------------------------------------ |
| `_amount`   | `uint`    | the amount the user wishes to deposit                        |
| `_duration` | `uint`    | the duration that they want to lock their tokens up for      |
| `_receiver` | `address` | the receiver of the share tokens resulting from this deposit |

### Withdraw

Users can withdraw their principle after the deposit duration has been met. Withdrawing deposit tokens results in a proportional burn of the share token.

| **Name**     | **Type**  | **Description**                            |
| ------------ | --------- | ------------------------------------------ |
| `_depositId` | `uint`    | the index of the user's deposit            |
| `_receiver`  | `address` | the receiver of the tokens to be withdrawn |

### extendLock

Users can extend the deposit duration for their staked funds. This will result in more share tokens being minted, proportional to the increase in time.

| **Name**            | **Type** | **Description**                               |
| ------------------- | -------- | --------------------------------------------- |
| `_depositId`        | `uint`   | the index of the user's deposits              |
| `_increaseDuration` | `uint`   | the amount of time to increase the deposit by |

### increaseLock

The same as `entendLock` except that the user adds more funds to the deposit.

| **Name**          | **Type**  | **Description**                        |
| ----------------- | --------- | -------------------------------------- |
| `_depositId`      | `uint`    | the index of the user's deposits       |
| `_receiver`       | `address` | the receiver of the deposit withdrawal |
| `_increaseAmount` | `uint`    | the amount of coins to add             |

### claimRewards

Users can claim their share of the rewards (proportional to their share token holdings). These rewards are escrowed and locked based on the escrow `duration` set. Perion will set the escrow `duration` to zero and therefore the user can claim the reward as soon as they become available.

| **Name**    | **Type**  | **Description**             |
| ----------- | --------- | --------------------------- |
| `_receiver` | `address` | the receiver of the rewards |

### distributeRewards

This function calculates the reward per share token and deposits tokens from the caller into the pool. This function can be called by anyone but is typically only called by the perion treasury multisig. This call enables `claimRewards` to work.

| **Name**  | **Type** | **Description**                               |
| --------- | -------- | --------------------------------------------- |
| `_amount` | `uint`   | the amount of reward tokens to be distributed |

## Usage

### Pre Requisites

Before running any command, you need to create a `.env` file and set a BIP-39 compatible mnemonic as an environment
variable. Follow the example in `.env.example`. If you don't already have a mnemonic, use this [website](https://iancoleman.io/bip39/) to generate one.

Then, proceed with installing dependencies:

```sh
yarn install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### TypeChain

Compile the smart contracts and generate TypeChain artifacts:

```sh
$ yarn typechain
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Test

Run the Mocha tests:

```sh
$ yarn test
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Report Gas

See the gas usage per unit test and average gas per method call:

```sh
$ REPORT_GAS=true yarn test
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ yarn clean
```

### Deploy

Deploy the contracts to Hardhat Network:

```sh
$ yarn deploy --greeting "Bonjour, le monde!"
```

## Syntax Highlighting

If you use VSCode, you can enjoy syntax highlighting for your Solidity code via the
[vscode-solidity](https://github.com/juanfranblanco/vscode-solidity) extension. The recommended approach to set the
compiler version is to add the following fields to your VSCode user settings:

```json
{
  "solidity.compileUsingRemoteVersion": "v0.8.4+commit.c7e474f2",
  "solidity.defaultCompiler": "remote"
}
```

Where of course `v0.8.4+commit.c7e474f2` can be replaced with any other version.
