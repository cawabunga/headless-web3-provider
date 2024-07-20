import { test as base } from '@playwright/test'
import {
	injectHeadlessWeb3Provider,
	type Web3ProviderBackend,
	type Web3RequestKind,
} from '../src/index.js'
import { privateKeyToAddress } from 'viem/accounts'
import type { Address, Hex } from 'viem'
import { anvil } from 'viem/chains'
import { getAnvilInstance } from './services/anvil/anvilPoolClient'

type InjectWeb3Provider = (
	privateKeys?: Hex[],
	permitted?: (Web3RequestKind | string)[],
) => Promise<Web3ProviderBackend>

export const test = base.extend<{
	signers: [Hex, ...Hex[]]
	accounts: Address[]
	injectWeb3Provider: InjectWeb3Provider
	anvilRpcUrl: string
}>({
	signers: [
		// anvil dev key
		'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
	],

	accounts: async ({ signers }, use) => {
		await use(signers.map((k) => privateKeyToAddress(k)))
	},

	// biome-ignore lint/correctness/noEmptyPattern: <explanation>
	anvilRpcUrl: async ({}, use) => {
		const anvilInstance = await getAnvilInstance()
		await use(anvilInstance.rpcUrl)
		await anvilInstance.destroy()
	},

	injectWeb3Provider: async ({ page, signers, anvilRpcUrl }, use) => {
		await use((privateKeys = signers, permitted = []) =>
			injectHeadlessWeb3Provider(
				page,
				privateKeys,
				{ ...anvil, rpcUrls: { default: { http: [anvilRpcUrl] } } },
				{
					permitted,
				},
			),
		)
	},
})

export const { expect, describe } = test
