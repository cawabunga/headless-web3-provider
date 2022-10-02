# Headless Web3 Provider

Metamask replacement for your E2E tests. Why "headless"? Because it doesn't have a visual interface, reject (or accept) transactions direcly from your code!

## Installation

```shell
npm i -D headless-web3-provider
```

## About
The library emulates a Web3 wallet behaviour like Metamask. It is useful for E2E testing if your application sends transactions or uses ethereum authentication.
The library allows to programatically accept or decline operations (switching a network, connecting a wallet, sending a transaction).

## Examples

### Playwright

Set up (add a fixture):
```js
// tests/fixtures.js
import { test as base } from '@playwright/test'
import { injectHeadlessWeb3Provider } from 'headless-web3-provider'

export const test = base.extend({
  signers: [process.env.PRIVATE_KEY],
  
  injectWeb3Provider: async ({ page, signers }, use) => {
    await use((privateKeys = signers) => (
      injectHeadlessWeb3Provider(page, privateKeys, 1377, 'http://localhost:8545')
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
  const wallet = await injectWeb3Provider()
  
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
