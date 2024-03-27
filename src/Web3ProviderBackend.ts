import {
  BehaviorSubject,
  filter,
  first,
  firstValueFrom,
  from,
  switchMap,
  tap,
} from 'rxjs'
import { ethers, Wallet } from 'ethers'
import { type JsonRpcEngine } from '@metamask/json-rpc-engine'
import type { JsonRpcRequest } from '@metamask/utils'

import { Web3RequestKind } from './utils'
import {
  ChainDisconnected,
  Deny,
  Disconnected,
  ErrorWithCode,
  Unauthorized,
} from './errors'
import { ChainConnection, IWeb3Provider, PendingRequest } from './types'
import { EventEmitter } from './EventEmitter'
import { WalletPermissionSystem } from './wallet/WalletPermissionSystem'
import { makeRpcEngine } from './jsonRpcEngine'

export interface Web3ProviderConfig {
  debug?: boolean
  logger?: typeof console.log
  permitted?: (Web3RequestKind | string)[]
}

export class Web3ProviderBackend extends EventEmitter implements IWeb3Provider {
  #pendingRequests$ = new BehaviorSubject<PendingRequest[]>([])
  #wallets: ethers.Signer[] = []
  #wps: WalletPermissionSystem
  #engine: JsonRpcEngine

  private _activeChainId: number
  private _rpc: Record<number, ethers.providers.JsonRpcProvider> = {}
  private _config: { debug: boolean; logger: typeof console.log }

  constructor(
    privateKeys: string[],
    private readonly chains: ChainConnection[],
    config: Web3ProviderConfig = {}
  ) {
    super()
    this.#wallets = privateKeys.map((key) => new ethers.Wallet(key))
    this._activeChainId = chains[0].chainId
    this._config = Object.assign({ debug: false, logger: console.log }, config)
    this.#wps = new WalletPermissionSystem(config.permitted)
    this.#engine = makeRpcEngine({
      addNetwork: (chainId, rpcUrl) => this.addNetwork(chainId, rpcUrl),
      currentChainThunk: () => this.getCurrentChain(),
      debug: this._config.debug,
      emit: (eventName, ...args) => this.emit(eventName, ...args),
      logger: this._config.logger,
      providerThunk: () => this.getRpc(),
      switchNetwork: (chainId) => this.switchNetwork(chainId),
      walletThunk: () => this.#getCurrentWallet() as Wallet,
      walletsThunk: () => this.#wallets,
      waitAuthorization: (req, task) => this.waitAuthorization(req, task),
      wps: this.#wps,
    })
  }

  async request(req: Pick<JsonRpcRequest, 'method' | 'params'>): Promise<any> {
    const res = await this.#engine.handle({
      id: null,
      jsonrpc: '2.0',
      ...req,
    })

    if ('result' in res) {
      return res.result
    } else {
      throw res.error
    }
  }

  #getCurrentWallet(): ethers.Signer {
    const wallet = this.#wallets[0]

    if (wallet == null) {
      throw Unauthorized()
    }

    return wallet
  }

  waitAuthorization<T>(req: JsonRpcRequest, task: () => Promise<T>) {
    if (this.#wps.isPermitted(req.method, '')) {
      return task()
    }

    return new Promise<T>((resolve, reject) => {
      const pendingRequest: PendingRequest = {
        requestInfo: req,
        authorize: async () => {
          resolve(await task())
        },
        reject(err) {
          reject(err)
        },
      }

      this.#pendingRequests$.next(
        this.#pendingRequests$.getValue().concat(pendingRequest)
      )
    })
  }

  private consumeRequest(requestKind: Web3RequestKind) {
    return firstValueFrom(
      this.#pendingRequests$.pipe(
        switchMap((a) => from(a)),
        filter((request) => {
          return request.requestInfo.method === requestKind
        }),
        first(),
        tap((item) => {
          this.#pendingRequests$.next(
            without(this.#pendingRequests$.getValue(), item)
          )
        })
      )
    )
  }

  private consumeAllRequests() {
    const a = this.#pendingRequests$.getValue()
    this.#pendingRequests$.next([])
    return a
  }

  getPendingRequests(): PendingRequest['requestInfo'][] {
    return this.#pendingRequests$.getValue().map((r) => r.requestInfo)
  }

  getPendingRequestCount(requestKind?: Web3RequestKind): number {
    const pendingRequests = this.#pendingRequests$.getValue()
    if (requestKind == null) {
      return pendingRequests.length
    }

    return pendingRequests.filter(
      (request) => request.requestInfo.method === requestKind
    ).length
  }

  async authorize(requestKind: Web3RequestKind): Promise<void> {
    const pendingRequest = await this.consumeRequest(requestKind)
    return pendingRequest.authorize()
  }

  async reject(
    requestKind: Web3RequestKind,
    reason: ErrorWithCode = Deny()
  ): Promise<void> {
    const pendingRequest = await this.consumeRequest(requestKind)
    return pendingRequest.reject(reason)
  }

  authorizeAll(): void {
    this.consumeAllRequests().forEach((request) => request.authorize())
  }

  rejectAll(reason: ErrorWithCode = Deny()): void {
    this.consumeAllRequests().forEach((request) => request.reject(reason))
  }

  async changeAccounts(privateKeys: string[]): Promise<void> {
    this.#wallets = privateKeys.map((key) => new ethers.Wallet(key))
    this.emit(
      'accountsChanged',
      await Promise.all(
        this.#wallets.map(async (wallet) =>
          (await wallet.getAddress()).toLowerCase()
        )
      )
    )
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

  private getRpc(): ethers.providers.JsonRpcProvider {
    const chain = this.getCurrentChain()
    let rpc = this._rpc[chain.chainId]

    if (!rpc) {
      rpc = new ethers.providers.JsonRpcProvider(chain.rpcUrl, chain.chainId)
      this._rpc[chain.chainId] = this._rpc[chain.chainId]
    }

    return rpc
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

function without<T>(list: T[], item: T): T[] {
  const idx = list.indexOf(item)
  if (~idx) {
    return list.slice(0, idx).concat(list.slice(idx + 1))
  }
  return list
}
