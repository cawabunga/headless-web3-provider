# Headless Web3 Provider

[![Playwright Tests](https://github.com/cawabunga/headless-web3-provider/actions/workflows/playwright.yml/badge.svg)](https://github.com/cawabunga/headless-web3-provider/actions/workflows/playwright.yml)

Upgrade your E2E tests with `headless-web3-provider` - the Metamask replacement for Ethereum-based apps. No visual interface needed, control transactions directly from your code!

## Installation

```shell
npm i -D headless-web3-provider
```

## About
The `headless-web3-provider` library emulates a Web3 wallet similar to Metamask and provides programmatic control over various operations, such as switching networks, connecting a wallet, and sending transactions, making it useful for end-to-end testing of Ethereum-based applications. It allows to programmatically accept or decline operations, making it handy for test automation.

#### Supported methods

| Method                     | Confirmable |
|----------------------------|-------------|
| eth_requestAccounts        | Yes         |
| eth_accounts               | Yes         |
| eth_sendTransaction        | Yes         |
| wallet_addEthereumChain    | Yes         |
| wallet_switchEthereumChain | Yes         |
| wallet_requestPermissions  | Yes         |
| personal_sign              | Yes         |
| eth_signTypedData          | Yes         |
| eth_signTypedData_v1       | Yes         |
| eth_signTypedData_v3       | Yes         |
| eth_signTypedData_v4       | Yes         |
| eth_call                   | No          |
| eth_estimateGas            | No          |
| eth_blockNumber            | No          |
| eth_getBlockByNumber       | No          |
| eth_getTransactionByHash   | No          |
| eth_getTransactionReceipt  | No          |
| eth_chainId                | No          |
| net_version                | No          |


## Examples

### Playwright
Below given a simple example. More complex scenarios you can find in [tests/e2e](./tests/e2e) folder.

Setup (add a fixture):
```js
// tests/fixtures.js
import { test as base } from '@playwright/test'
import { injectHeadlessWeb3Provider } from 'headless-web3-provider'

export const test = base.extend({
  // signers - the private keys that are to be used in the tests
  signers: [process.env.PRIVATE_KEY],
  
  // injectWeb3Provider - function that injects web3 provider instance into the page
  injectWeb3Provider: async ({ signers }, use) => {
    await use((page, privateKeys = signers) => (
      injectHeadlessWeb3Provider(
        page,
        privateKeys,            // Private keys that you want to use in tests
        31337,                  // Chain ID - 31337 is common testnet id
        'http://localhost:8545' // Ethereum client's JSON-RPC URL
      )
    ))
  },
})
```

Usage:
```js
// tests/e2e/example.spec.js
import { test } from '../fixtures'

test('connect the wallet', async ({ page, injectWeb3Provider }) => {
  // Inject window.ethereum instance
  const wallet = await injectWeb3Provider(page)
  
  await page.goto('https://metamask.github.io/test-dapp/')

  // Request connecting the wallet
  await page.locator('text=Connect').click()

  // You can either authorize or reject the request
  await wallet.authorize(Web3RequestKind.RequestAccounts)

  // Verify if the wallet is really connected
  await test.expect(page.locator('text=Connected')).toBeVisible()
  await test.expect(page.locator('text=0x8b3a08b22d25c60e4b2bfd984e331568eca4c299')).toBeVisible()
})
```

### Jest
Add a helper script for injecting the ethereum provider instance.
```ts
// tests/web3-helper.ts
import { Wallet } from 'ethers'
import { makeHeadlessWeb3Provider, Web3ProviderBackend } from 'headless-web3-provider'

/**
 * injectWeb3Provider - Function to create and inject web3 provider instance into the global window object
 *
 * @returns {Array} An array containing the wallets and the web3Provider instance
 */
export function injectWeb3Provider(): [[Wallet, ...Wallet[]], Web3ProviderBackend] {

  // Create 2 random instances of Wallet class
  const wallets = Array(2).fill(0).map(() => Wallet.createRandom()) as [Wallet, Wallet]

  // Create an instance of the Web3ProviderBackend class
  let web3Manager: Web3ProviderBackend = makeHeadlessWeb3Provider(
    wallets.map((wallet) => wallet.privateKey),
    31337,                  // Chain ID - 31337 or  is a common testnet id
    'http://localhost:8545' // Ethereum client's JSON-RPC URL
  )

  // Expose the web3Provider instance to the global window object
  // @ts-ignore-error
  window.ethereum = web3Manager

  // Return the created wallets and web3Provider instance
  return [wallets, web3Manager]
}
```

```ts
// AccountConnect.test.ts
import { act, render, screen } from '@testing-library/react'
import type { Wallet } from 'ethers'
import { Web3ProviderBackend, Web3RequestKind } from 'headless-web3-provider'
import userEvent from '@testing-library/user-event'
import { injectWeb3Provider } from 'tests/web3-helper' // Our just created helper script
import AccountConnect from './AccountConnect'

describe('<AccountConnect />', () => {
  let wallets: [Wallet, ...Wallet[]]
  let web3Manager: Web3ProviderBackend

  beforeEach(() => {
    // Inject window.ethereum instance
    ;[wallets, web3Manager] = injectWeb3Provider()
  })

  it('renders user address after connecting', async () => {
    render(<AccountConnect />)

    // Request connecting the wallet
    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }))


    // Verify if the wallet is NOT yet connected
    expect(screen.queryByText(wallets[0].address)).not.toBeInTheDocument()
    
    await act(async () => {
      // You can either authorize or reject the request
      await web3Manager.authorize(Web3RequestKind.RequestAccounts)
    })

    // Verify if the wallet is connected
    expect(screen.getByText(wallets[0].address)).toBeInTheDocument()
  })
})
```

## Resources

- [Metamask Test DApp](https://metamask.github.io/test-dapp/)
- [Metamask JSON-RPC API](https://metamask.github.io/api-playground/api-documentation/)
- [Metamask Provider API](https://docs.metamask.io/guide/ethereum-provider.html)
- [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) Ethereum Provider JavaScript API
- [EIP-3085](https://eips.ethereum.org/EIPS/eip-3085) Wallet Add Ethereum Chain RPC Method (`wallet_addEthereumChain`)
