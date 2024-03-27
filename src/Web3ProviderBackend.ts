import assert from 'node:assert/strict'
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
import { toUtf8String } from 'ethers/lib/utils'
import { signTypedData, SignTypedDataVersion } from '@metamask/eth-sig-util'
import {
  createAsyncMiddleware,
  type JsonRpcEngine,
} from '@metamask/json-rpc-engine'
import type { JsonRpcRequest } from '@metamask/utils'

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
import { WalletPermissionSystem } from './wallet/WalletPermissionSystem'
import { makeRpcEngine } from './jsonRpcEngine'

interface ChainConnection {
  chainId: number
  rpcUrl: string
}

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
      debug: this._config.debug,
      emit: (eventName, ...args) => this.emit(eventName, ...args),
      logger: this._config.logger,
      providerThunk: () => this.getRpc(),
      walletsThunk: () => this.#wallets,
      waitAuthorization: (req, task) => this.waitAuthorization(req, task),
      wps: this.#wps,
    })
    this.#engine.push(
      createAsyncMiddleware(async (req, res, next) => {
        try {
          res.result = await this._request(req)
        } catch (err) {
          res.error = err as any
        }
      })
    )
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

  async _request(req: JsonRpcRequest): Promise<any> {
    switch (req.method) {
      case 'eth_chainId': {
        const { chainId } = this.getCurrentChain()
        return '0x' + chainId.toString(16)
      }

      case 'net_version': {
        const { chainId } = this.getCurrentChain()
        return chainId
      }

      case 'eth_sendTransaction': {
        const wallet = this.#getCurrentWallet()
        const rpc = this.getRpc()
        // @ts-expect-error todo: parse params
        const jsonRpcTx = req.params[0]

        const txRequest = convertJsonRpcTxToEthersTxRequest(jsonRpcTx)
        try {
          const tx = await wallet.connect(rpc).sendTransaction(txRequest)
          return tx.hash
        } catch (err) {
          throw err
        }
      }

      case 'wallet_addEthereumChain': {
        // @ts-expect-error todo: parse params
        const chainId = Number(req.params[0].chainId)
        // @ts-expect-error todo: parse params
        const rpcUrl = req.params[0].rpcUrls[0]
        this.addNetwork(chainId, rpcUrl)
        return null
      }

      case 'wallet_switchEthereumChain': {
        // @ts-expect-error todo: parse params
        if (this._activeChainId === Number(req.params[0].chainId)) {
          return null
        }

        // @ts-expect-error todo: parse params
        const chainId = Number(req.params[0].chainId)
        this.switchNetwork(chainId)
        return null
      }

      // todo: use the Wallet Permissions System (WPS) to handle method
      case 'wallet_requestPermissions': {
        if (
          // @ts-expect-error todo: parse params
          req.params.length === 0 ||
          // @ts-expect-error todo: parse params
          req.params[0].eth_accounts === undefined
        ) {
          throw Deny()
        }

        const accounts = await Promise.all(
          this.#wallets.map(async (wallet) =>
            (await wallet.getAddress()).toLowerCase()
          )
        )
        this.emit('accountsChanged', accounts)
        return [{ parentCapability: 'eth_accounts' }]
      }

      case 'personal_sign': {
        const wallet = this.#getCurrentWallet()
        const address = await wallet.getAddress()
        // @ts-expect-error todo: parse params
        assert.equal(address, ethers.utils.getAddress(req.params[1]))
        // @ts-expect-error todo: parse params
        const message = toUtf8String(req.params[0])

        const signature = await wallet.signMessage(message)
        if (this._config.debug) {
          this._config.logger('personal_sign', {
            message,
            signature,
          })
        }

        return signature
      }

      case 'eth_signTypedData':
      case 'eth_signTypedData_v1': {
        const wallet = this.#getCurrentWallet() as Wallet
        const address = await wallet.getAddress()
        // @ts-expect-error todo: parse params
        assert.equal(address, ethers.utils.getAddress(req.params[1]))

        // @ts-expect-error todo: parse params
        const msgParams = req.params[0]

        return signTypedData({
          privateKey: Buffer.from(wallet.privateKey.slice(2), 'hex'),
          data: msgParams,
          version: SignTypedDataVersion.V1,
        })
      }

      case 'eth_signTypedData_v3':
      case 'eth_signTypedData_v4': {
        const wallet = this.#getCurrentWallet() as Wallet
        const address = await wallet.getAddress()
        // @ts-expect-error todo: parse params
        assert.equal(address, ethers.utils.getAddress(req.params[0]))

        // @ts-expect-error todo: parse params
        const msgParams = JSON.parse(req.params[1])

        return signTypedData({
          privateKey: Buffer.from(wallet.privateKey.slice(2), 'hex'),
          data: msgParams,
          version:
            req.method === 'eth_signTypedData_v4'
              ? SignTypedDataVersion.V4
              : SignTypedDataVersion.V3,
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

// Allowed keys for a JSON-RPC transaction as defined in:
// https://ethereum.github.io/execution-apis/api-documentation/
const allowedTransactionKeys = [
  'accessList',
  'chainId',
  'data',
  'from',
  'gas',
  'gasPrice',
  'maxFeePerGas',
  'maxPriorityFeePerGas',
  'nonce',
  'to',
  'type',
  'value',
]

// Convert a JSON-RPC transaction to an ethers.js transaction.
// The reverse of this function can be found in the ethers.js library:
// https://github.com/ethers-io/ethers.js/blob/v5.7.2/packages/providers/src.ts/json-rpc-provider.ts#L701
function convertJsonRpcTxToEthersTxRequest(tx: {
  [key: string]: any
}): ethers.providers.TransactionRequest {
  const result: any = {}

  allowedTransactionKeys.forEach((key) => {
    if (tx[key] == null) {
      return
    }

    switch (key) {
      // gasLimit is referred to as "gas" in JSON-RPC
      case 'gas':
        result['gasLimit'] = tx[key]
        return
      // ethers.js expects `chainId` and `type` to be a number
      case 'chainId':
      case 'type':
        result[key] = Number(tx[key])
        return
      default:
        result[key] = tx[key]
    }
  })
  return result
}
