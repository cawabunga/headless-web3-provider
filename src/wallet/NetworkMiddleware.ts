import {
  createAsyncMiddleware,
  type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import type { Json, JsonRpcParams } from '@metamask/utils'
import type { ChainConnection } from '../types'

export function makeNetworkMiddleware(
  currentChainThunk: () => ChainConnection,
  addNetwork: (chainId: number, rpcUrl: string) => void,
  switchNetwork: (chainId_: number) => void
) {
  const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
    createAsyncMiddleware(async (req, res, next) => {
      switch (req.method) {
        case 'eth_chainId': {
          const { chainId } = currentChainThunk()
          res.result = '0x' + chainId.toString(16)
          break
        }

        case 'net_version': {
          const { chainId } = currentChainThunk()
          res.result = chainId
          break
        }

        case 'wallet_addEthereumChain': {
          // @ts-expect-error todo: parse params
          const chainId = Number(req.params[0].chainId)
          // @ts-expect-error todo: parse params
          const rpcUrl = req.params[0].rpcUrls[0]
          addNetwork(chainId, rpcUrl)

          res.result = null
          break
        }

        case 'wallet_switchEthereumChain': {
          const { chainId } = currentChainThunk()

          // @ts-expect-error todo: parse params
          if (chainId !== Number(req.params[0].chainId)) {
            // @ts-expect-error todo: parse params
            const chainId = Number(req.params[0].chainId)
            switchNetwork(chainId)
          }

          res.result = null
          break
        }

        default:
          void next()
      }
    })

  return middleware
}
