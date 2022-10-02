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
  signers: [ethers.Wallet.createRandom().privateKey],

  accounts: async ({ signers }, use) => {
    await use(signers.map((k) => new ethers.Wallet(k).address))
  },

  injectWeb3Provider: async ({ page, signers }, use) => {
    await use((privateKeys = signers) =>
      injectHeadlessWeb3Provider(
        page,
        privateKeys,
        1337,
        'http://localhost:8545'
      )
    )
  },
})

export const { expect } = test
