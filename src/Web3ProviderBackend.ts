import { type JsonRpcEngine } from '@metamask/json-rpc-engine'
import type { JsonRpcParams, JsonRpcRequest } from '@metamask/utils'

import { Web3RequestKind } from './utils'
import {
  ChainDisconnected,
  Disconnected,
} from './errors'
import { ChainConnection, IWeb3Provider } from './types'
import { EventEmitter } from './EventEmitter'
import { makeRpcEngine } from './jsonRpcEngine'
import { Account, Chain, Transport, WalletClient } from 'viem'

export interface Web3ProviderConfig {
  debug?: boolean
  logger?: typeof console.log
  permitted?: (Web3RequestKind | string)[]
}

export class Web3ProviderBackend extends EventEmitter implements IWeb3Provider {
  #client: WalletClient<Transport, Chain, Account>
  #engine: JsonRpcEngine

  private _activeChainId: number
  private _config: { debug: boolean; logger: typeof console.log }

  constructor(
    privateKeys: string[],
    private readonly chains: ChainConnection[],
    config: Web3ProviderConfig = {}
  ) {
    super()
    this._activeChainId = chains[0].chainId
    this._config = Object.assign({ debug: false, logger: console.log }, config)
    this.#engine = makeRpcEngine({
      debug: this._config.debug,
      logger: this._config.logger,
    })
  }

  async request(req: Pick<JsonRpcRequest, 'method' | 'params'>): Promise<any> {
    const res = await this.#engine.handle({
      jsonrpc: '2.0',
      id: 1,
      method: req.method,
      params: req.params as JsonRpcParams
    })

    if ('result' in res) {
      return res.result
    } else {
      throw res.error
    }
  }

  private getCurrentChain(): ChainConnection {
    const chainConn = this.chains.find(
      ({ chainId }) => chainId === this._activeChainId
    )
    if (!chainConn) {
      throw Disconnected()
    }
    return chainConn
  }

  getNetwork(): ChainConnection {
    return this.getCurrentChain()
  }

  getNetworks(): ChainConnection[] {
    return this.chains
  }

  addNetwork(chainId: number, rpcUrl: string): void {
    this.chains.push({ chainId, rpcUrl })
  }

  switchNetwork(chainId_: number): void {
    const chainConn = this.chains.findIndex(
      ({ chainId }) => chainId === chainId_
    )
    if (!~chainConn) {
      throw ChainDisconnected()
    }
    this._activeChainId = chainId_
    this.emit('chainChanged', chainId_)
  }
}