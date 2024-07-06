import {
	createAsyncMiddleware,
	type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import type { PublicClient } from 'viem'

// User safe methods
const methods = [
	'eth_blockNumber',
	'eth_call',
	'eth_estimateGas',
	'eth_gasPrice',
	'eth_getBalance',
	'eth_getBlockByHash',
	'eth_getBlockByNumber',
	'eth_getBlockTransactionCountByHash',
	'eth_getBlockTransactionCountByNumber',
	'eth_getCode',
	'eth_getLogs',
	'eth_getStorageAt',
	'eth_getTransactionByBlockHashAndIndex',
	'eth_getTransactionByBlockNumberAndIndex',
	'eth_getTransactionByHash',
	'eth_getTransactionCount',
	'eth_getTransactionReceipt',
	'eth_getUncleByBlockHashAndIndex',
	'eth_getUncleByBlockNumberAndIndex',
	'eth_getUncleCountByBlockHash',
	'eth_getUncleCountByBlockNumber',
	'eth_sendRawTransaction',
]

/**
 * Creates a middleware which passes through safe requests to a real node
 * @param providerThunk
 */
export function makePassThroughMiddleware(provider: PublicClient) {
	const passThroughMiddleware: JsonRpcMiddleware<any, any> =
		createAsyncMiddleware(async (req, res, next) => {
			if (methods.includes(req.method)) {
				// @ts-expect-error Params are not typed
				const result = await provider.request(req)
				res.result = result
			} else {
				void next()
			}
		})

	return passThroughMiddleware
}
