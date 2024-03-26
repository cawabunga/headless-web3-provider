import { JsonRpcEngine } from '@metamask/json-rpc-engine'
import type { JsonRpcRequest } from '@metamask/utils'
import type { ethers } from 'ethers'
import { makePassThroughMiddleware } from './wallet/PassthroughMiddleware'
import { makeAuthorizeMiddleware } from './wallet/AuthorizeMiddleware'

export function makeRpcEngine({
  debug,
  logger,
  providerThunk,
  waitAuthorization,
}: {
  debug?: boolean
  logger?: (message: string) => void
  providerThunk: () => ethers.providers.JsonRpcProvider
  waitAuthorization: (
    req: JsonRpcRequest,
    task: () => Promise<void>
  ) => Promise<void>
}) {
  const engine = new JsonRpcEngine()

  // Just logs incoming RPC requests
  engine.push((req, res, next) => {
    if (debug) logger?.('Request: ' + req.method)
    next()
  })

  // Pass through safe requests to real node
  engine.push(makeAuthorizeMiddleware(waitAuthorization))
  engine.push(makePassThroughMiddleware(providerThunk))

  return engine
}
