import { expect, test, describe } from '../fixtures'
import { type Web3ProviderBackend, Web3RequestKind } from '../../src'

let wallet: Web3ProviderBackend

describe('Auto connected', () => {
	test.beforeEach(async ({ page, injectWeb3Provider }) => {
		// Inject window.ethereum instance
		wallet = await injectWeb3Provider(undefined, [Web3RequestKind.Accounts])

		// In order to make https://metamask.github.io/test-dapp/ work flag should be set
		await page.addInitScript(() => (window.ethereum.isMetaMask = true))

		await page.goto('https://metamask.github.io/test-dapp/')
	})

	test('my address', async ({ page, accounts }) => {
		// Already connected, no need to connect again
		await page
			.getByRole('button', { name: 'Connected', exact: true })
			.isDisabled()

		// Verify if the wallet is really connected
		await expect(page.locator('text=' + accounts[0])).toBeVisible()

		// Accounts should be available
		await expect(page.locator('#getAccountsResult')).toBeEmpty()
		await page.getByRole('button', { name: 'ETH_ACCOUNTS' }).click()
		await expect(page.locator('#getAccountsResult')).toContainText(accounts[0])
	})
})
