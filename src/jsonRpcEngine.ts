import { JsonRpcEngine } from '@metamask/json-rpc-engine'
import type { JsonRpcRequest } from '@metamask/utils'
import type { ethers } from 'ethers'
import { makePassThroughMiddleware } from './wallet/PassthroughMiddleware'
import { makeAuthorizeMiddleware } from './wallet/AuthorizeMiddleware'
import { makeAccountsMiddleware } from './wallet/AccountsMiddleware'
import { WalletPermissionSystem } from './wallet/WalletPermissionSystem'

export function makeRpcEngine({
  debug,
  logger,
  emit,
  providerThunk,
  walletsThunk,
  waitAuthorization,
  wps,
}: {
  debug?: boolean
  emit: (eventName: string, ...args: any[]) => void
  logger?: (message: string) => void
  providerThunk: () => ethers.providers.JsonRpcProvider
  walletsThunk: () => ethers.Signer[]
  waitAuthorization: (
    req: JsonRpcRequest,
    task: () => Promise<void>
  ) => Promise<void>
  wps: WalletPermissionSystem
}) {
  const engine = new JsonRpcEngine()

  // Just logs incoming RPC requests
  engine.push((req, res, next) => {
    if (debug) logger?.('Request: ' + req.method)
    next()
  })

  engine.push(makeAuthorizeMiddleware(waitAuthorization))
  engine.push(makeAccountsMiddleware(emit, walletsThunk, wps))
  engine.push(makePassThroughMiddleware(providerThunk))

  return engine
}
