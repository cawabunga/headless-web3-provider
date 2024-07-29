import { test as base } from '@playwright/test'
import type { Address, Hex } from 'viem'
import { privateKeyToAddress } from 'viem/accounts'
import { anvil } from 'viem/chains'

import type { Web3ProviderConfig } from '../src/Web3ProviderBackend.js'
import {
	type Web3ProviderBackend,
	injectHeadlessWeb3Provider,
} from '../src/index.js'
import { getAnvilInstance } from './services/anvil/anvilPoolClient.js'

type InjectWeb3Provider = (
	parameters?: Partial<Pick<Web3ProviderConfig, 'privateKeys' | 'permitted'>>,
) => Promise<Web3ProviderBackend>

export const test = base.extend<{
	signers: [Hex, ...Hex[]]
	accounts: Address[]
	injectWeb3Provider: InjectWeb3Provider
	anvilRpcUrl: string
	wallet: Web3ProviderBackend
}>({
	signers: [
		// anvil dev key
		'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
	],

	accounts: async ({ signers }, use) => {
		await use(signers.map((k) => privateKeyToAddress(k)))
	},

	// biome-ignore lint/correctness/noEmptyPattern: <explanation>
	anvilRpcUrl: async ({}, use, { workerIndex }) => {
		const anvilInstance = getAnvilInstance({ workerIndex })
		await use(anvilInstance.rpcUrl)
		await anvilInstance.restart()
	},

	injectWeb3Provider: async ({ page, signers, anvilRpcUrl }, use) => {
		await use(({ privateKeys = signers, permitted = [] } = {}) =>
			injectHeadlessWeb3Provider({
				page,
				privateKeys,
				chains: [{ ...anvil, rpcUrls: { default: { http: [anvilRpcUrl] } } }],
				permitted,
			}),
		)
	},

	wallet: [
		async ({ injectWeb3Provider, page }, use) => {
			// Inject window.ethereum instance
			const wallet = await injectWeb3Provider()

			// In order to make https://metamask.github.io/test-dapp/ work flag should be set
			// @ts-expect-error
			// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
			await page.addInitScript(() => (window.ethereum!.isMetaMask = true))

			await page.goto('https://metamask.github.io/test-dapp/')

			await use(wallet)
		},
		{ scope: 'test' },
	],
})

export const { expect, describe } = test
