import { JsonRpcEngine } from '@metamask/json-rpc-engine'
import { UnsupportedMethod } from './errors'

export function makeRpcEngine({
  debug,
  logger,
}: {
  debug?: boolean
  logger?: (message: string) => void
}): JsonRpcEngine {
  const engine = new JsonRpcEngine()

  // Just logs incoming RPC requests
  engine.push((req, res, next) => {
    if (debug) logger?.('Request: ' + req.method)
    next()
  })
  // Catch unhandled methods
  engine.push((req, res, next, end) => {
    end(UnsupportedMethod())
  })

  return engine
}
