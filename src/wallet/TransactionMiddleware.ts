import {
  createAsyncMiddleware,
  type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import type { Json, JsonRpcParams } from '@metamask/utils'
import { ethers } from 'ethers'

export function makeTransactionMiddleware(
  providerThunk: () => ethers.providers.JsonRpcProvider,
  walletThunk: () => ethers.Wallet
) {
  const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
    createAsyncMiddleware(async (req, res, next) => {
      switch (req.method) {
        case 'eth_sendTransaction': {
          const wallet = walletThunk()
          const rpc = providerThunk()
          // @ts-expect-error todo: parse params
          const jsonRpcTx = req.params[0]

          const txRequest = convertJsonRpcTxToEthersTxRequest(jsonRpcTx)
          const tx = await wallet.connect(rpc).sendTransaction(txRequest)

          res.result = tx.hash
          break
        }

        default:
          void next()
      }
    })

  return middleware
}

// Allowed keys for a JSON-RPC transaction as defined in:
// https://ethereum.github.io/execution-apis/api-documentation/
const allowedTransactionKeys = [
  'accessList',
  'chainId',
  'data',
  'from',
  'gas',
  'gasPrice',
  'maxFeePerGas',
  'maxPriorityFeePerGas',
  'nonce',
  'to',
  'type',
  'value',
]

// Convert a JSON-RPC transaction to an ethers.js transaction.
// The reverse of this function can be found in the ethers.js library:
// https://github.com/ethers-io/ethers.js/blob/v5.7.2/packages/providers/src.ts/json-rpc-provider.ts#L701
function convertJsonRpcTxToEthersTxRequest(tx: {
  [key: string]: any
}): ethers.providers.TransactionRequest {
  const result: any = {}

  allowedTransactionKeys.forEach((key) => {
    if (tx[key] == null) {
      return
    }

    switch (key) {
      // gasLimit is referred to as "gas" in JSON-RPC
      case 'gas':
        result['gasLimit'] = tx[key]
        return
      // ethers.js expects `chainId` and `type` to be a number
      case 'chainId':
      case 'type':
        result[key] = Number(tx[key])
        return
      default:
        result[key] = tx[key]
    }
  })
  return result
}
