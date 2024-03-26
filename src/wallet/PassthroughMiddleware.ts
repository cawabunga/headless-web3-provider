import type { ethers } from 'ethers'
import {
  createAsyncMiddleware,
  type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import type { Json, JsonRpcParams } from '@metamask/utils'

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
export function makePassThroughMiddleware(
  providerThunk: () => ethers.providers.JsonRpcProvider
) {
  const passThroughMiddleware: JsonRpcMiddleware<JsonRpcParams, Json> =
    createAsyncMiddleware(async (req, res, next) => {
      if (methods.includes(req.method)) {
        // @ts-expect-error Params are not typed
        const result = await providerThunk().send(req.method, req.params)
        res.result = result
      } else {
        void next()
      }
    })

  return passThroughMiddleware
}
