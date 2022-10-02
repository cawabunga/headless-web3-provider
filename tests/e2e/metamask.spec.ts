import { test, expect } from '../fixtures'
import { Web3RequestKind } from '../../'

test('connect the wallet', async ({ page, injectWeb3Provider, accounts }) => {
  // Inject window.ethereum instance
  const wallet = await injectWeb3Provider()

  await page.goto('https://metamask.github.io/test-dapp/')

  // Request connecting the wallet
  await page.locator('text=Connect').click()

  // You can either authorize or reject the request
  await wallet.authorize(Web3RequestKind.RequestAccounts)

  // Verify if the wallet is really connected
  await expect(page.locator('text=Connected')).toBeVisible()
  await expect(page.locator('text=' + accounts[0])).toBeVisible()
})
