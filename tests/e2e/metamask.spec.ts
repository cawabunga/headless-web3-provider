import { ethers } from 'ethers'
import { expect, test } from '../fixtures'
import { IWeb3Provider, Web3ProviderBackend, Web3RequestKind } from '../../src'

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

  expect(
    wallet.getPendingRequestCount(Web3RequestKind.RequestAccounts)
  ).toEqual(1)

  // You can either authorize or reject the request
  await wallet.authorize(Web3RequestKind.RequestAccounts)

  expect(
    wallet.getPendingRequestCount(Web3RequestKind.RequestAccounts)
  ).toEqual(0)

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
  wallet.addNetwork(1338, 'http://127.0.0.1:8546')

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

test('deploy a token', async ({ page }) => {
  await page.locator('text=Connect').click()
  await wallet.authorize(Web3RequestKind.RequestAccounts)

  await expect(page.locator('#tokenAddress')).toBeEmpty()
  await page.locator('text=Create Token').click()
  await expect(page.locator('#tokenAddress')).toBeEmpty()

  await wallet.authorize(Web3RequestKind.SendTransaction)
  await expect(page.locator('#tokenAddress')).toContainText(/0x.+/)
})

/**
 * Suite tests "personal_sign" RPC method
 */
test('sign a message', async ({ page, signers }) => {
  // Establish a connection with the wallet
  await page.locator('text=Connect').click()
  // Authorize the request for account access
  await wallet.authorize(Web3RequestKind.RequestAccounts)

  // Expect the result element to be empty before signing
  await expect(page.locator('#personalSignResult')).toBeEmpty()
  // Initiate the signing process
  await page.locator('#personalSign').click()

  // Expect the result element to be empty before authorizing the request
  await expect(page.locator('#personalSignResult')).toBeEmpty()
  // Authorize the request to sign the message
  await wallet.authorize(Web3RequestKind.SignMessage)

  // Prepare the signed message
  const message = 'Example `personal_sign` message'
  const signer = new ethers.Wallet(signers[0])
  const signedMessage = await signer.signMessage(message)

  await expect(page.locator('#personalSignResult')).toContainText(signedMessage)
})
