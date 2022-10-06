import { test, expect } from '../fixtures'
import { Web3RequestKind } from '../../'
import { IWeb3Provider, Web3ProviderBackend } from '../../src'

declare global {
  interface Window {
    ethereum: IWeb3Provider
  }
}

let wallet: Web3ProviderBackend

test.beforeEach(async ({ page, injectWeb3Provider }) => {
  // Inject window.ethereum instance
  wallet = await injectWeb3Provider()

  // In order to make https://metamask.github.io/test-dapp/ work flag should be set
  await page.addInitScript(() => (window.ethereum.isMetaMask = true))

  await page.goto('https://metamask.github.io/test-dapp/')
})

test('connect the wallet', async ({ page, accounts }) => {
  // Request connecting the wallet
  await page.locator('text=Connect').click()

  // You can either authorize or reject the request
  await wallet.authorize(Web3RequestKind.RequestAccounts)

  // Verify if the wallet is really connected
  await expect(page.locator('text=Connected')).toBeVisible()
  await expect(page.locator('text=' + accounts[0])).toBeVisible()
})

test('add a new network', async ({ page }) => {
  await page.locator('text=Add Localhost').click()

  const networkCount = wallet.getNetworks().length
  await wallet.authorize(Web3RequestKind.AddEthereumChain)

  expect(wallet.getNetworks().length).toEqual(networkCount + 1)
})

test('switch a new network', async ({ page }) => {
  wallet.addNetwork(1338, 'http://localhost:8546')

  const [prevNetworkId, prevChainId] = await page.evaluate(() =>
    Promise.all([
      window.ethereum.request({ method: 'net_version', params: [] }),
      window.ethereum.request({ method: 'eth_chainId', params: [] }),
    ])
  )

  await page.locator('text=Switch to Localhost').click()
  await wallet.authorize(Web3RequestKind.SwitchEthereumChain)

  const [newNetworkId, newChainId] = await page.evaluate(() =>
    Promise.all([
      window.ethereum.request({ method: 'net_version', params: [] }),
      window.ethereum.request({ method: 'eth_chainId', params: [] }),
    ])
  )

  expect(newNetworkId).toEqual(1338)
  expect(newChainId).toEqual('0x53a')
  expect(prevNetworkId).not.toEqual(newNetworkId)
  expect(prevChainId).not.toEqual(newChainId)
})
