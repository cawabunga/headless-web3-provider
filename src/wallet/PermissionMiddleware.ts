import {
  createAsyncMiddleware,
  type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import type { Json, JsonRpcParams } from '@metamask/utils'
import type { Signer } from 'ethers'
import { Web3RequestKind } from '../utils'
import type { WalletPermissionSystem } from './WalletPermissionSystem'
import { Deny } from '../errors'

export function makePermissionMiddleware(
  emit: (eventName: string, ...args: any[]) => void,
  walletsThunk: () => Signer[]
) {
  const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
    createAsyncMiddleware(async (req, res, next) => {
      switch (req.method) {
        // todo: use the Wallet Permissions System (WPS) to handle method
        case 'wallet_requestPermissions': {
          if (
            // @ts-expect-error todo: parse params
            req.params.length === 0 ||
            // @ts-expect-error todo: parse params
            req.params[0].eth_accounts === undefined
          ) {
            throw Deny()
          }

          const accounts = await Promise.all(
            walletsThunk().map(async (wallet) =>
              (await wallet.getAddress()).toLowerCase()
            )
          )
          emit('accountsChanged', accounts)

          res.result = [{ parentCapability: 'eth_accounts' }]
          break
        }

        default:
          void next()
      }
    })

  return middleware
}
