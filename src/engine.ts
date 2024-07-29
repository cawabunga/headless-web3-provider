import { JsonRpcEngine } from '@metamask/json-rpc-engine'
import type { Account, Chain } from 'viem'

import { UnsupportedMethod } from './errors.js'
import type { ChainTransport, JsonRpcRequest } from './types.js'
import { createAccountsMiddleware } from './wallet/AccountsMiddleware.js'
import { createAuthorizeMiddleware } from './wallet/AuthorizeMiddleware.js'
import { createChainMiddleware } from './wallet/ChainMiddleware.js'
import { createPassThroughMiddleware } from './wallet/PassthroughMiddleware.js'
import { createPermissionMiddleware } from './wallet/PermissionMiddleware.js'
import type { WalletPermissionSystem } from './wallet/WalletPermissionSystem.js'

type RpcEngineConfig = {
	emit: (eventName: string, ...args: any[]) => void
	logger?: (message: string) => void
	debug?: boolean
	accounts: Account[]
	wps: WalletPermissionSystem
	waitAuthorization: (
		req: JsonRpcRequest,
		task: () => Promise<void>,
	) => Promise<void>
	addChain: (chain: Chain) => void
	switchChain: (chainId: number) => void
	getChain: () => Chain
	getChainTransport: () => ChainTransport
}

export function createRpcEngine({
	emit,
	debug,
	logger,
	accounts,
	wps,
	waitAuthorization,
	addChain,
	switchChain,
	getChain,
	getChainTransport,
}: RpcEngineConfig) {
	const engine = new JsonRpcEngine()

	engine.push((req, _res, next) => {
		if (debug) logger?.(`Request: ${req.method}`)
		next()
	})

	engine.push(createAuthorizeMiddleware({ waitAuthorization }))
	engine.push(createAccountsMiddleware({ emit, accounts, wps }))

	engine.push(createChainMiddleware({ getChain, addChain, switchChain }))
	engine.push(createPermissionMiddleware({ emit, accounts }))
	engine.push(createPassThroughMiddleware({ getChainTransport }))

	engine.push((_req, _res, _next, end) => {
		end(UnsupportedMethod())
	})

	return engine
}
