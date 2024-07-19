import {
	createPublicClient,
	http,
	type Account,
	type Chain,
	type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { EventEmitter } from './EventEmitter'
import { ChainDisconnected, Deny, type ErrorWithCode } from './errors'
import type { JsonRpcRequest, PendingRequest } from './types'
import type { Web3RequestKind } from './utils'
import { WalletPermissionSystem } from './wallet/WalletPermissionSystem'
import type { JsonRpcEngine } from '@metamask/json-rpc-engine'
import { makeRpcEngine } from './engine'
import type { EIP1193EventMap, EIP1193Provider, PublicClient } from 'viem'
import type { EIP1193Parameters } from 'viem'
import type { Json } from '@metamask/utils'

export interface Web3ProviderConfig {
	debug?: boolean
	logger?: typeof console.log
	permitted?: (Web3RequestKind | string)[]
}

export class Web3ProviderBackend
	extends EventEmitter
	implements EIP1193Provider
{
	private accounts: Account[] = []
	private activeChain: Chain
	private chains: Chain[] = []
	private wps: WalletPermissionSystem
	private pendingRequests: PendingRequest[] = []
	private engine: JsonRpcEngine

	constructor(
		privateKeys: Hex[],
		private readonly _chains: Chain[],
		config: Web3ProviderConfig = {},
	) {
		super()
		this.activeChain = _chains[0]
		this.chains = _chains

		privateKeys.forEach((pk) => this.accounts.push(privateKeyToAccount(pk)))

		this.wps = new WalletPermissionSystem(config.permitted)
		this.engine = makeRpcEngine({
			emit: this.emit.bind(this),
			debug: config.debug,
			logger: config.logger,
			wps: this.wps,
			accounts: this.accounts,
			waitAuthorization: (req, task) => this.waitAuthorization(req, task),
			currentChain: this.activeChain,
			addNetwork: (chain) => this.addNetwork(chain),
			switchNetwork: (chain) => this.switchNetwork(chain),
			provider: this.getRpc(),
		})
	}
	removeListener<TEvent extends keyof EIP1193EventMap>(
		event: TEvent,
		listener: EIP1193EventMap[TEvent],
	): void {
		throw new Error('Method not implemented.')
	}

	isMetaMask?: boolean
	// @ts-expect-error
	async request(req: EIP1193Parameters): Promise<Json> {
		const res = await this.engine.handle({
			method: req.method,
			params: req.params as `0x${string}`[],
			id: null,
			jsonrpc: '2.0',
		})

		if ('result' in res) {
			return res.result
		}

		throw res.error
	}
	getNetworks() {
		return this.chains.map((chain) => chain.id)
	}

	getNetwork(): Chain {
		return this.activeChain
	}

	addNetwork(chain: Chain): void {
		this.chains.push(chain)
	}

	switchNetwork(chainId: number): void {
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

		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		return request!
	}
	async authorize(requestKind: Web3RequestKind): Promise<void> {
		const pendingRequest = this.consumeRequest(requestKind)
		return pendingRequest.authorize()
	}

	private getRpc(): PublicClient {
		const chain = this.activeChain

		const rpc = createPublicClient({
			chain,
			transport: http(chain.rpcUrls.default.http[0]),
		})

		return rpc
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
