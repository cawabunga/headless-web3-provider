import {
  createAsyncMiddleware,
  type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import type { Json, JsonRpcParams } from '@metamask/utils'
import type { Signer } from 'ethers'
import { Web3RequestKind } from '../utils'
import type { WalletPermissionSystem } from './WalletPermissionSystem'

export function makeAccountsMiddleware(
  emit: (eventName: string, ...args: any[]) => void,
  walletsThunk: () => Signer[],
  wps: WalletPermissionSystem
) {
  const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
    createAsyncMiddleware(async (req, res, next) => {
      switch (req.method) {
        case 'eth_accounts':
          if (wps.isPermitted(Web3RequestKind.Accounts, '')) {
            res.result = await Promise.all(
              walletsThunk().map(async (wallet) =>
                (await wallet.getAddress()).toLowerCase()
              )
            )
          } else {
            res.result = []
          }
          break

        case 'eth_requestAccounts':
          wps.permit(Web3RequestKind.Accounts, '')

          const accounts = await Promise.all(
            walletsThunk().map(async (wallet) =>
              (await wallet.getAddress()).toLowerCase()
            )
          )

          emit('accountsChanged', accounts)
          res.result = accounts
          break

        default:
          void next()
      }
    })

  return middleware
}
