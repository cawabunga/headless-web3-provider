import {
  filter,
  firstValueFrom,
  BehaviorSubject,
  switchMap,
  from,
  first,
  tap,
} from 'rxjs'
import { ethers } from 'ethers'
import { Web3RequestKind } from './utils'
import { Deny, ErrorWithCode, Unauthorized, UnsupportedMethod } from './errors'
import { IWeb3Provider, PendingRequest } from './types'
import { EventEmitter } from './EventEmitter'

export class Web3ProviderBackend extends EventEmitter implements IWeb3Provider {
  #pendingRequests$ = new BehaviorSubject<PendingRequest[]>([])
  #wallets: ethers.Signer[] = []

  constructor(
    privateKeys: string[],
    private readonly chainId: number,
    private readonly chainRpc: ethers.providers.BaseProvider
  ) {
    super()
    this.#wallets = privateKeys.map((key) => new ethers.Wallet(key))
  }

  request(args: { method: 'eth_accounts'; params: string[] }): Promise<string[]>
  request(args: {
    method: 'eth_requestAccounts'
    params: string[]
  }): Promise<string[]>
  request(args: { method: 'eth_chainId'; params: string[] }): Promise<string>
  request(args: { method: 'personal_sign'; params: string[] }): Promise<string>
  async request({
    method,
    params,
  }: {
    method: string
    params: any[]
  }): Promise<any> {
    console.log({ method, params })

    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return this.waitAuthorization({ method, params }, async () => {
          this.emit('connect', { chainId: this.chainId })
          return Promise.all(this.#wallets.map((wallet) => wallet.getAddress()))
        })

      case 'eth_chainId':
        return this.chainId

      case 'eth_sendTransaction': {
        return this.waitAuthorization({ method, params }, async () => {
          const wallet = this.#getCurrentWallet()
          const tx = await wallet.signTransaction(params[0])
          return this.chainRpc.sendTransaction(tx)
        })
      }

      case 'wallet_switchEthereumChain': {
        return this.waitAuthorization({ method, params }, async () => {
          this.emit('chainChanged', this.chainId)
          return null
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
    task: () => Promise<T>
  ) {
    return new Promise((resolve, reject) => {
      const pendingRequest: PendingRequest = {
        requestInfo: requestInfo,
        async authorize() {
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
}

function without<T>(list: T[], item: T): T[] {
  const idx = list.indexOf(item)
  if (~idx) {
    return list.slice(0, idx).concat(list.slice(idx + 1))
  }
  return list
}
