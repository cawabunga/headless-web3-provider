import {
	type JsonRpcMiddleware,
	createAsyncMiddleware,
} from '@metamask/json-rpc-engine'
import type { Json, JsonRpcParams } from '@metamask/utils'
import {
	type Chain,
	type LocalAccount,
	type TransactionRequest,
	createWalletClient,
	formatTransaction,
} from 'viem'
import type { ChainTransport } from '../types.js'

export function createTransactionMiddleware({
	getChain,
	account,
	getChainTransport,
}: {
	getChain: () => Chain
	account: LocalAccount
	getChainTransport: () => ChainTransport
}) {
	const walletClient = createWalletClient({
		account,
		chain: getChain(),
		transport: getChainTransport,
	})
	const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
		createAsyncMiddleware(async (req, res, next) => {
			switch (req.method) {
				case 'eth_sendTransaction': {
					// @ts-expect-error todo: parse params
					const jsonRpcTx = req.params[0] as JsonRpcTx

					const viemTx = formatTransaction(jsonRpcTx)

					try {
						res.result = await walletClient.sendTransaction(
							viemTx as TransactionRequest,
						)
					} catch (e) {
						console.error('Error submitting transaction', e, viemTx)
					}

					break
				}

				default:
					void next()
			}
		})

	return middleware
}
