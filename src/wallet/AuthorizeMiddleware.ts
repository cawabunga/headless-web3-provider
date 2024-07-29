import {
	type JsonRpcMiddleware,
	createAsyncMiddleware,
} from '@metamask/json-rpc-engine'

import type { JsonRpcRequest } from '../types.js'

// User un-safe methods
const methods = [
	'eth_requestAccounts',
	// 'eth_accounts', It is actually safe, because it returns [] when user did not connect the site
	'eth_sendTransaction',
	'wallet_addEthereumChain',
	'wallet_switchEthereumChain', // Caveat: It is safe if chain is active one
	'wallet_requestPermissions',
	'personal_sign',
	'eth_signTypedData',
	'eth_signTypedData_v1',
	'eth_signTypedData_v3',
	'eth_signTypedData_v4',
]

type AuthorizeMiddlewareConfig = {
	waitAuthorization: (
		req: JsonRpcRequest,
		task: () => Promise<void>,
	) => Promise<void>
}

/**
 * Creates a middleware which stops user-specific methods from being
 * sent until the user has authorized them
 * @param waitAuthorization
 */
export function createAuthorizeMiddleware({
	waitAuthorization,
}: AuthorizeMiddlewareConfig) {
	const authorizeMiddleware: JsonRpcMiddleware<string[], string[]> =
		createAsyncMiddleware(async (req, _res, next) => {
			if (methods.includes(req.method)) {
				// Pass `next` to the authorization handler.
				// This is necessary because many tests simulate authorization by calling:
				// `await wallet.authorize('eth_someMethod')`
				// Followed by actions dependent on the authorization and invocation of the method.
				// This ensures that the method is both authorized and executed as expected.
				await waitAuthorization(req as JsonRpcRequest, next)
			} else {
				next()
			}
		})

	return authorizeMiddleware
}
