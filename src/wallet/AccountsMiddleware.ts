import {
	createAsyncMiddleware,
	type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import { Web3RequestKind } from '../utils'
import type { WalletPermissionSystem } from './WalletPermissionSystem'
import type { Account, Address } from 'viem'

export function makeAccountsMiddleware(
	emit: (eventName: string, ...args: [Address[]]) => void,
	accounts: Account[],
	wps: WalletPermissionSystem,
) {
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
