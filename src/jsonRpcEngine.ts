import { JsonRpcEngine } from '@metamask/json-rpc-engine'
import type { ethers } from 'ethers'
import { makePassThroughMiddleware } from './wallet/PassthroughMiddleware'

export function makeRpcEngine({
  debug,
  logger,
  providerThunk,
}: {
  debug?: boolean
  logger?: (message: string) => void
  providerThunk: () => ethers.providers.JsonRpcProvider
}) {
  const engine = new JsonRpcEngine()

  // Just logs incoming RPC requests
  engine.push((req, res, next) => {
    if (debug) logger?.('Request: ' + req.method)
    next()
  })

  // Pass through safe requests to real node
  engine.push(makePassThroughMiddleware(providerThunk))

  return engine
}
