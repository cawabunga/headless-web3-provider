import {
  filter,
  firstValueFrom,
  BehaviorSubject,
  switchMap,
  from,
  first,
  tap,
} from 'rxjs'
import { ethers, Wallet } from 'ethers'
import { signTypedData, SignTypedDataVersion } from '@metamask/eth-sig-util'
import assert from 'assert/strict'

import { Web3RequestKind } from './utils'
import {
  ChainDisconnected,
  Deny,
  Disconnected,
  ErrorWithCode,
  Unauthorized,
  UnsupportedMethod,
} from './errors'
import { IWeb3Provider, PendingRequest } from './types'
import { EventEmitter } from './EventEmitter'
import { toUtf8String } from 'ethers/lib/utils'

interface ChainConnection {
  chainId: number
  rpcUrl: string
}

export interface Web3ProviderConfig {
  debug?: boolean
  logger?: typeof console.log
}

export class Web3ProviderBackend extends EventEmitter implements IWeb3Provider {
  #pendingRequests$ = new BehaviorSubject<PendingRequest[]>([])
  #wallets: ethers.Signer[] = []
  private _activeChainId: number
  private _rpc: Record<number, ethers.providers.JsonRpcProvider> = {}
  private _config: { debug: boolean; logger: typeof console.log }
  private _authorizedRequests: { [K in Web3RequestKind | string]?: boolean } =
    {}

  constructor(
    privateKeys: string[],
    private readonly chains: ChainConnection[],
    config: Web3ProviderConfig = {}
  ) {
    super()
    this.#wallets = privateKeys.map((key) => new ethers.Wallet(key))
    this._activeChainId = chains[0].chainId
    this._config = Object.assign({ debug: false, logger: console.log }, config)
  }

  request(args: { method: 'eth_accounts'; params: [] }): Promise<string[]>
  request(args: {
    method: 'eth_requestAccounts'
    params: string[]
  }): Promise<string[]>
  request(args: { method: 'net_version'; params: [] }): Promise<number>
  request(args: { method: 'eth_chainId'; params: [] }): Promise<string>
  request(args: { method: 'personal_sign'; params: string[] }): Promise<string>
  request(args: {
    method: 'eth_signTypedData' | 'eth_signTypedData_v1'
    params: [object[], string]
  }): Promise<string>
  request(args: {
    method: 'eth_signTypedData_v3' | 'eth_signTypedData_v4'
    params: string[]
  }): Promise<string>
  async request({
    method,
    params,
  }: {
    method: string
    params: any[]
  }): Promise<any> {
    if (this._config.debug) {
      this._config.logger({ method, params })
    }

    switch (method) {
      case 'eth_call':
      case 'eth_estimateGas':
      case 'eth_blockNumber':
      case 'eth_getBlockByNumber':
      case 'eth_getTransactionByHash':
      case 'eth_getTransactionReceipt':
        return this.getRpc().send(method, params)

      case 'eth_requestAccounts': {
        return this.waitAuthorization(
          { method, params },
          async () => {
            const accounts = await Promise.all(this.#wallets.map((wallet) => wallet.getAddress()))
            this.emit('accountsChanged', accounts)
            return accounts
          },
          true
        )
      }

      case 'eth_accounts': {
        if (this._authorizedRequests['eth_requestAccounts']) {
          return await Promise.all(this.#wallets.map((wallet) => wallet.getAddress()))
        }
        return []
      }

      case 'eth_chainId': {
        const { chainId } = this.getCurrentChain()
        return '0x' + chainId.toString(16)
      }

      case 'net_version': {
        const { chainId } = this.getCurrentChain()
        return chainId
      }

      case 'eth_sendTransaction': {
        return this.waitAuthorization({ method, params }, async () => {
          const wallet = this.#getCurrentWallet()
          const rpc = this.getRpc()
          const { gas, ...txRequest } = params[0]
          const tx = await wallet.connect(rpc).sendTransaction(txRequest)
          return tx.hash
        })
      }

      case 'wallet_addEthereumChain': {
        return this.waitAuthorization({ method, params }, async () => {
          const chainId = Number(params[0].chainId)
          const rpcUrl = params[0].rpcUrls[0]
          this.addNetwork(chainId, rpcUrl)
          return null
        })
      }

      case 'wallet_switchEthereumChain': {
        if (this._activeChainId === Number(params[0].chainId)) {
          return null
        }
        return this.waitAuthorization({ method, params }, async () => {
          const chainId = Number(params[0].chainId)
          this.switchNetwork(chainId)
          return null
        })
      }

      case 'personal_sign': {
        return this.waitAuthorization({ method, params }, async () => {
          const wallet = this.#getCurrentWallet()
          const address = await wallet.getAddress()
          assert.equal(address, ethers.utils.getAddress(params[1]))
          const message = toUtf8String(params[0])

          const signature = await wallet.signMessage(message)
          if (this._config.debug) {
            this._config.logger('personal_sign', {
              message,
              signature,
            })
          }

          return signature
        })
      }

      case 'eth_signTypedData':
      case 'eth_signTypedData_v1': {
        return this.waitAuthorization({ method, params }, async () => {
          const wallet = this.#getCurrentWallet() as Wallet
          const address = await wallet.getAddress()
          assert.equal(address, ethers.utils.getAddress(params[1]))

          const msgParams = params[0]

          return signTypedData({
            privateKey: Buffer.from(wallet.privateKey.slice(2), 'hex'),
            data: msgParams,
            version: SignTypedDataVersion.V1,
          })
        })
      }

      case 'eth_signTypedData_v3':
      case 'eth_signTypedData_v4': {
        return this.waitAuthorization({ method, params }, async () => {
          const wallet = this.#getCurrentWallet() as Wallet
          const address = await wallet.getAddress()
          assert.equal(address, ethers.utils.getAddress(params[0]))

          const msgParams = JSON.parse(params[1])

          return signTypedData({
            privateKey: Buffer.from(wallet.privateKey.slice(2), 'hex'),
            data: msgParams,
            version:
              method === 'eth_signTypedData_v4'
                ? SignTypedDataVersion.V4
                : SignTypedDataVersion.V3,
          })
        })
      }

      default:
        throw UnsupportedMethod()
    }
  }

  #getCurrentWallet(): ethers.Signer {
    const wallet = this.#wallets[0]

    if (wallet == null) {
      throw Unauthorized()
    }

    return wallet
  }

  waitAuthorization<T>(
    requestInfo: PendingRequest['requestInfo'],
    task: () => Promise<T>,
    permanentPermission = false,
  ) {
    if (this._authorizedRequests[requestInfo.method]) {
      return task()
    }

    return new Promise((resolve, reject) => {
      const pendingRequest: PendingRequest = {
        requestInfo: requestInfo,
        authorize: async () => {
          if (permanentPermission) {
            this._authorizedRequests[requestInfo.method] = true
          }

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
      await Promise.all(this.#wallets.map((wallet) => wallet.getAddress()))
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
