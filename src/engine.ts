import { JsonRpcEngine } from '@metamask/json-rpc-engine'
import type { Account, Chain } from 'viem'

import { UnsupportedMethod } from './errors'
import type { ChainTransport, JsonRpcRequest } from './types'
import { createAccountsMiddleware } from './wallet/AccountsMiddleware'
import { createAuthorizeMiddleware } from './wallet/AuthorizeMiddleware'
import { createChainMiddleware } from './wallet/ChainMiddleware'
import { createPassThroughMiddleware } from './wallet/PassthroughMiddleware'
import { createPermissionMiddleware } from './wallet/PermissionMiddleware'
import type { WalletPermissionSystem } from './wallet/WalletPermissionSystem'

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
