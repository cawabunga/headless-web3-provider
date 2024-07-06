import {
	createAsyncMiddleware,
	type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import { Deny } from '../errors'
import type { Account } from 'viem'

export function makePermissionMiddleware(
	emit: (eventName: string, ...args: any[]) => void,
	accounts: Account[],
) {
	const middleware: JsonRpcMiddleware<
		{ eth_accounts?: string }[],
		[{ parentCapability: 'eth_accounts' }]
	> = createAsyncMiddleware(async (req, res, next) => {
		switch (req.method) {
			// todo: use the Wallet Permissions System (WPS) to handle method
			case 'wallet_requestPermissions': {
				if (
					req.params?.length === 0 ||
					req.params?.[0].eth_accounts === undefined
				) {
					throw Deny()
				}

				const addresses = accounts.map((a) => a.address)
				emit('accountsChanged', addresses)

				res.result = [{ parentCapability: 'eth_accounts' }]
				break
			}

			default:
				void next()
		}
	})

	return middleware
}
