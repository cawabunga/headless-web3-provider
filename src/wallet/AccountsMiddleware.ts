import {
	type JsonRpcMiddleware,
	createAsyncMiddleware,
} from '@metamask/json-rpc-engine'
import type { Account, Address } from 'viem'

import { Web3RequestKind } from '../utils.js'
import type { WalletPermissionSystem } from './WalletPermissionSystem.js'

type AccountsMiddlewareConfig = {
	emit: (eventName: string, ...args: [Address[]]) => void
	accounts: Account[]
	wps: WalletPermissionSystem
}

export function createAccountsMiddleware({
	emit,
	accounts,
	wps,
}: AccountsMiddlewareConfig) {
	const middleware: JsonRpcMiddleware<[], Address[]> = createAsyncMiddleware(
		async (req, res, next) => {
			switch (req.method) {
				case 'eth_accounts':
					if (wps.isPermitted(Web3RequestKind.Accounts, '')) {
						res.result = accounts.map((a) => a.address)
					} else {
						res.result = []
					}
					break

				case 'eth_requestAccounts': {
					wps.permit(Web3RequestKind.Accounts, '')

					const addresses = accounts.map((a) => a.address)

					emit('accountsChanged', addresses)
					res.result = addresses
					break
				}

				default:
					void next()
			}
		},
	)

	return middleware
}
