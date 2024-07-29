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
	private accounts: LocalAccount[] = []
	private activeChain: Chain
	private chains: Chain[] = []
	private wps: WalletPermissionSystem
	private pendingRequests: PendingRequest[] = []
	private engine: JsonRpcEngine

	constructor({ privateKeys, chains, ...config }: Web3ProviderConfig) {
		super()
		this.activeChain = chains[0]
		this.chains = chains

		privateKeys.forEach((pk) => this.accounts.push(privateKeyToAccount(pk)))

		this.wps = new WalletPermissionSystem(config.permitted)
		this.engine = createRpcEngine({
			emit: this.emit.bind(this),
			debug: config.debug,
			logger: config.logger,
			wps: this.wps,
			accounts: this.accounts,
			waitAuthorization: this.waitAuthorization.bind(this),
			addChain: this.addChain.bind(this),
			switchChain: this.switchChain.bind(this),
			getChain: this.getChain.bind(this),
			getChainTransport: this.getChainTransport.bind(this),
		})
	}

	isMetaMask?: boolean

	// @ts-expect-error
	async request(req: EIP1193Parameters): Promise<Json> {
		const res = await this.engine
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
		const perm = this.wps.isPermitted('eth_accounts', '')
		return perm
	}

	getChainIds() {
		return this.chains.map((chain) => chain.id)
	}

	getChain() {
		return this.activeChain
	}

	addChain(chain: Chain) {
		this.chains.push(chain)
	}

	switchChain(chainId: number): void {
		const chain = this.chains.find(({ id }) => id === chainId)
		if (!chain) {
			throw ChainDisconnected()
		}
		this.activeChain = chain
		this.emit('chainChanged', chainId)
	}

	getPendingRequestCount(requestKind?: Web3RequestKind): number {
		const pendingRequests = this.pendingRequests
		if (requestKind == null) {
			return pendingRequests.length
		}

		return pendingRequests.filter(
			(request) => request.requestInfo.method === requestKind,
		).length
	}

	private consumeRequest(requestKind: Web3RequestKind) {
		const request = this.pendingRequests.find((request) => {
			return request.requestInfo.method === requestKind
		})

		// If found, remove it from the pendingRequests array
		if (request) {
			this.pendingRequests = this.pendingRequests.filter(
				(item) => item !== request,
			)
		}

		return request!
	}

	async authorize(requestKind: Web3RequestKind): Promise<void> {
		const pendingRequest = this.consumeRequest(requestKind)
		return pendingRequest.authorize()
	}

	private getChainTransport(): ChainTransport {
		const chain = this.activeChain

		const transport = http(chain.rpcUrls.default.http[0])({ chain })

		return transport
	}

	async reject(
		requestKind: Web3RequestKind,
		reason: ErrorWithCode = Deny(),
	): Promise<void> {
		const pendingRequest = this.consumeRequest(requestKind)
		return pendingRequest.reject(reason)
	}

	waitAuthorization<T>(req: JsonRpcRequest, task: () => Promise<T>) {
		if (this.wps.isPermitted(req.method, '')) {
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

			this.pendingRequests.push(pendingRequest)
			return this.pendingRequests
		})
	}
}
