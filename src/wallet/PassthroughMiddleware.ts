import {
	createAsyncMiddleware,
	type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'

import type { ChainTransport } from '../types'

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
] as const

type Method = (typeof methods)[number]

type PassthroughMiddlewareConfig = {
	getChainTransport: () => ChainTransport
}

/**
 * Creates a middleware which passes through safe requests to a real node
 * @param providerThunk
 */
export function createPassThroughMiddleware({ getChainTransport }: PassthroughMiddlewareConfig) {
	const passThroughMiddleware: JsonRpcMiddleware<any, any> =
		createAsyncMiddleware(async (req, res, next) => {
			if (methods.includes(req.method as Method)) {
				const transport = getChainTransport()
				res.result = await transport.request(req).catch((e) => {
					console.error('Error!!!', e)
				})
			} else {
				next()
			}
		})

	return passThroughMiddleware
}
