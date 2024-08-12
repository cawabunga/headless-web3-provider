import type { Web3ProviderBackend } from '../../src/backend.js'
import { Web3RequestKind } from '../../src/utils.js'
import { describe, expect, test } from '../fixtures.js'

let _wallet: Web3ProviderBackend

describe('Auto connected', () => {
	test.beforeEach(async ({ page, injectWeb3Provider }) => {
		// Inject window.ethereum instance
		_wallet = await injectWeb3Provider({
			permitted: [Web3RequestKind.Accounts],
		})

		await page.addInitScript(
			// @ts-expect-error
			// biome-ignore lint/suspicious/noAssignInExpressions: In order to make https://metamask.github.io/test-dapp work
			() => (window.ethereum!.isMetaMask = true),
		)

		await page.goto('https://metamask.github.io/test-dapp/')
	})

	test('my address', async ({ page, accounts }) => {
		// Already connected, no need to connect again
		await page
			.getByRole('button', { name: 'Connected', exact: true })
			.isDisabled()

		// Verify if the wallet is really connected
		await expect(page.locator(`text=${accounts[0]}`)).toBeVisible()

		// Accounts should be available
		await expect(page.locator('#getAccountsResult')).toBeEmpty()
		await page.getByRole('button', { name: 'ETH_ACCOUNTS' }).click()
		await expect(page.locator('#getAccountsResult')).toContainText(accounts[0])
	})
})
