import type { Account, Chain, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { EIP1193Parameters, EIP1474Methods } from 'viem/types/eip1193'
import { EventEmitter } from './EventEmitter'
import { ChainDisconnected } from './errors'
import type { IWeb3Provider, JsonRpcRequest, PendingRequest } from './types'
import { Web3RequestKind } from './utils'
import { WalletPermissionSystem } from './wallet/WalletPermissionSystem'

export interface Web3ProviderConfig {
	debug?: boolean
	logger?: typeof console.log
	permitted?: (Web3RequestKind | string)[]
}

export class Web3ProviderBackend extends EventEmitter implements IWeb3Provider {
	#accounts: Account[] = []
	#activeChain: Chain
	#chains: Chain[] = []
	#wps: WalletPermissionSystem
	#pendingRequests: PendingRequest[] = []
	constructor(
		privateKeys: Hex[],
		private readonly chains: Chain[],
		config: Web3ProviderConfig = {},
	) {
		super()
		this.#activeChain = chains[0]

		privateKeys.forEach((pk) => this.#accounts.push(privateKeyToAccount(pk)))

		this.#wps = new WalletPermissionSystem(config.permitted)
	}
	isMetaMask?: boolean | undefined

	getNetworks() {
		return this.#chains.map((chain) => chain.id)
	}

	async request(req: JsonRpcRequest) {
		switch (req.method) {
			case 'eth_chainId':
				return this.#activeChain.id
			case 'eth_accounts':
				if (this.#wps.isPermitted(Web3RequestKind.Accounts, '')) {
					return this.#accounts.map((a) => a.address)
				}
				return []
			case 'eth_requestAccounts': {
				this.#wps.permit(Web3RequestKind.Accounts, '')

				const accounts = this.#accounts.map((a) => a.address)

				this.emit('accountsChanged', accounts)
				return accounts
			}
		}
	}

	addNetwork(chain: Chain): void {
		this.chains.push(chain)
	}

	switchNetwork(chainId: number): void {
		const chain = this.chains.find(({ id }) => id === chainId)
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
	#consumeRequest(requestKind: Web3RequestKind) {
		const request = this.#pendingRequests.find((request) => {
			return request.requestInfo.method === requestKind
		})

		// If found, remove it from the pendingRequests array
		if (request) {
			this.#pendingRequests = this.#pendingRequests.filter(
				(item) => item !== request,
			)
		}

		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		return request!
	}
	async authorize(requestKind: Web3RequestKind): Promise<void> {
		const pendingRequest = this.#consumeRequest(requestKind)
		return pendingRequest.authorize()
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

			this.#pendingRequests.push(pendingRequest)
		})
	}
}
