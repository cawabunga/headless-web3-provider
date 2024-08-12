import type { JsonRpcEngine } from '@metamask/json-rpc-engine'
import {
	http,
	type Chain,
	type EIP1193Parameters,
	type EIP1193Provider,
	type Hex,
	type LocalAccount,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import type { Json } from '@metamask/utils'
import { EventEmitter } from './EventEmitter.js'
import { createRpcEngine } from './engine.js'
import { ChainDisconnected, Deny, type ErrorWithCode } from './errors.js'
import type { ChainTransport, JsonRpcRequest, PendingRequest } from './types.js'
import type { Web3RequestKind } from './utils.js'
import { WalletPermissionSystem } from './wallet/WalletPermissionSystem.js'

export interface Web3ProviderConfig {
	privateKeys: Hex[]
	chains: Chain[]
	debug?: boolean
	logger?: typeof console.log
	permitted?: (Web3RequestKind | string)[]
}

export type Web3ProviderBackendType = EIP1193Provider & EventEmitter

export class Web3ProviderBackend
	extends EventEmitter
	implements EIP1193Provider
{
	#accounts: LocalAccount[] = []
	#activeChain: Chain
	#chains: Chain[] = []
	#wps: WalletPermissionSystem
	#pendingRequests: PendingRequest[] = []
	#pendingActions: {
		method: Web3RequestKind
		type: 'authorize' | 'reject'
		notify: () => Promise<void>
	}[] = []
	#engine: JsonRpcEngine

	constructor({ privateKeys, chains, ...config }: Web3ProviderConfig) {
		super()
		this.#activeChain = chains[0]
		this.#chains = chains

		privateKeys.forEach((pk) => this.#accounts.push(privateKeyToAccount(pk)))

		this.#wps = new WalletPermissionSystem(config.permitted)
		this.#engine = createRpcEngine({
			emit: (eventName, ...args) => this.emit(eventName, ...args),
			debug: config.debug,
			logger: config.logger,
			wps: this.#wps,
			accounts: this.#accounts,
			waitAuthorization: (req, task) => this.waitAuthorization(req, task),
			addChain: (chain) => this.addChain(chain),
			switchChain: (chainId) => this.switchChain(chainId),
			getChain: () => this.getChain(),
			getChainTransport: () => this.getChainTransport(),
		})
	}

	isMetaMask?: boolean

	// @ts-expect-error
	async request(req: EIP1193Parameters): Promise<Json> {
		const res = await this.#engine
			.handle({
				method: req.method,
				params: req.params as `0x${string}`[],
				id: null,
				jsonrpc: '2.0',
			})
			.catch((e) => {
				console.error(e)
				throw e
			})

		if ('result' in res) {
			return res.result
		}

		throw res.error
	}

	isConnected() {
		const perm = this.#wps.isPermitted('eth_accounts', '')
		return perm
	}

	getChainIds() {
		return this.#chains.map((chain) => chain.id)
	}

	getChain() {
		return this.#activeChain
	}

	addChain(chain: Chain) {
		this.#chains.push(chain)
	}

	switchChain(chainId: number): void {
		const chain = this.#chains.find(({ id }) => id === chainId)
		if (!chain) {
			throw ChainDisconnected()
		}
		this.#activeChain = chain
		this.emit('chainChanged', chainId)
	}

	getPendingRequestCount(requestKind?: Web3RequestKind): number {
		const pendingRequests = this.#pendingRequests
		if (requestKind == null) {
			return pendingRequests.length
		}

		return pendingRequests.filter(
			(request) => request.requestInfo.method === requestKind,
		).length
	}

	private consumeRequest(requestKind: Web3RequestKind) {
		const requestIndex = this.#pendingRequests.findIndex((request) => {
			return request.requestInfo.method === requestKind
		})

		// If found, remove it from the pendingRequests array
		if (requestIndex !== -1) {
			const request = this.#pendingRequests[requestIndex]
			this.#pendingRequests.splice(requestIndex, 1)

			return request
		}

		return null
	}

	private consumeAction(requestKind: Web3RequestKind) {
		const actionIndex = this.#pendingActions.findIndex(
			(act) => act.method === requestKind,
		)

		if (actionIndex !== -1) {
			const action = this.#pendingActions[actionIndex]
			this.#pendingActions.splice(actionIndex, 1)

			return action
		}

		return null
	}

	private createAction({
		requestKind,
		type,
		callback,
	}: {
		requestKind: Web3RequestKind
		type: 'authorize' | 'reject'
		callback?: () => void
	}) {
		return new Promise<void>((resolve) => {
			const notify = async () => {
				resolve(callback?.())
			}

			this.#pendingActions.push({ method: requestKind, type, notify })
		})
	}

	async authorize(requestKind: Web3RequestKind): Promise<void> {
		const pendingRequest = this.consumeRequest(requestKind)

		if (pendingRequest) return pendingRequest.authorize()

		return this.createAction({ requestKind, type: 'authorize' })
	}

	async reject(
		requestKind: Web3RequestKind,
		reason: ErrorWithCode = Deny(),
	): Promise<void> {
		const pendingRequest = this.consumeRequest(requestKind)

		if (pendingRequest) return pendingRequest.reject(reason)

		return this.createAction({
			requestKind,
			type: 'reject',
			callback: () => Promise.reject(reason),
		})
	}

	private getChainTransport(): ChainTransport {
		const chain = this.#activeChain

		const transport = http(chain.rpcUrls.default.http[0])({ chain })

		return transport
	}

	async waitAuthorization<T>(req: JsonRpcRequest, task: () => Promise<T>) {
		if (this.#wps.isPermitted(req.method, '')) {
			return task()
		}

		const action = this.consumeAction(req.method as Web3RequestKind)
		if (action) {
			await task()
			return await action.notify()
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

			this.#pendingRequests.push(pendingRequest)
			return this.#pendingRequests
		})
	}
}
