import { ethers } from 'ethers'
import { test as base } from '@playwright/test'
import { injectHeadlessWeb3Provider, Web3ProviderBackend } from '../src'

type InjectWeb3Provider = (
  privateKeys?: string[]
) => Promise<Web3ProviderBackend>

export const test = base.extend<{
  signers: string[]
  accounts: string[]
  injectWeb3Provider: InjectWeb3Provider
}>({
  signers: [
    // anvil dev key
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  ],

  accounts: async ({ signers }, use) => {
    await use(signers.map((k) => new ethers.Wallet(k).address))
  },

  injectWeb3Provider: async ({ page, signers }, use) => {
    await use((privateKeys = signers) =>
      injectHeadlessWeb3Provider(
        page,
        privateKeys,
        31337,
        'http://127.0.0.1:8545'
      )
    )
  },
})

export const { expect } = test
