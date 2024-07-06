import { Web3RequestKind } from './utils'
import {
  ChainDisconnected,
} from './errors'
import { EventEmitter } from './EventEmitter'
import { WalletPermissionSystem } from './wallet/WalletPermissionSystem'
import { EIP1193Parameters, EIP1474Methods } from 'viem/types/eip1193'
import type { Account, Chain, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { IWeb3Provider } from './types'

export interface Web3ProviderConfig {
  debug?: boolean
  logger?: typeof console.log
  permitted?: (Web3RequestKind | string)[]
}

export class Web3ProviderBackend extends EventEmitter implements IWeb3Provider {
  #accounts: Account[] = []
  #activeChain: Chain
  #wps: WalletPermissionSystem

  constructor(
    privateKeys: Hex[],
    private readonly chains: Chain[],
    config: Web3ProviderConfig = {}
  ) {
    super()
    this.#activeChain = chains[0]

    privateKeys.forEach((pk) => this.#accounts.push(privateKeyToAccount(pk)))

    this.#wps = new WalletPermissionSystem(config.permitted)
  }

  async request(req: EIP1193Parameters<EIP1474Methods>) {
    switch (req.method) {
      case 'eth_chainId':
        return this.#activeChain.id
    }
   }

  addNetwork(chain: Chain): void {
    this.chains.push(chain)
  }

  switchNetwork(chainId: number): void {
    const chain = this.chains.find(
      ({ id }) => id === chainId
    )
    if (!chain) {
      throw ChainDisconnected()
    }
    this.#activeChain = chain
    this.emit('chainChanged', chainId)
  }
}