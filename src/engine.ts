import { JsonRpcEngine } from '@metamask/json-rpc-engine'
import { UnsupportedMethod } from './errors'
import { makeAccountsMiddleware } from './wallet/AccountsMiddleware'
import type { Account } from 'viem'
import type { WalletPermissionSystem } from './wallet/WalletPermissionSystem'
import { makeAuthorizeMiddleware } from './wallet/AuthorizeMiddleware'
import type { JsonRpcRequest } from './types'
import { makeNetworkMiddleware } from './wallet/NetworkMiddleware'
import type { Chain } from 'viem'
import { makePassThroughMiddleware } from './wallet/PassthroughMiddleware'
import type { PublicClient } from 'viem'
import { makePermissionMiddleware } from './wallet/PermissionMiddleware'
import type { EIP1193Provider } from 'viem'
import type { JsonRpcProvider } from '@ethersproject/providers'

export function makeRpcEngine({
	emit,
	debug,
	logger,
	accounts,
	wps,
	waitAuthorization,
	currentChain,
	addNetwork,
	switchNetwork,
	provider,
}: {
	emit: (eventName: string, ...args: any[]) => void
	logger?: (message: string) => void
	debug?: boolean
	accounts: Account[]
	wps: WalletPermissionSystem
	waitAuthorization: (
		req: JsonRpcRequest,
		task: () => Promise<void>,
	) => Promise<void>
	currentChain: Chain
	addNetwork: (chain: Chain) => void
	switchNetwork: (chainId: number) => void
	provider: JsonRpcProvider
}) {
	const engine = new JsonRpcEngine()

	engine.push((req, res, next) => {
		if (debug) logger?.(`Request: ${req.method}`)
		next()
	})

	engine.push(makeAuthorizeMiddleware(waitAuthorization))
	engine.push(makeAccountsMiddleware(emit, accounts, wps))

	engine.push(makeNetworkMiddleware(currentChain, addNetwork, switchNetwork))
	engine.push(makePermissionMiddleware(emit, accounts))
	engine.push(makePassThroughMiddleware(provider))

	engine.push((req, res, next, end) => {
		end(UnsupportedMethod())
	})

	return engine
}
