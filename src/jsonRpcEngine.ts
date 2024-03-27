import { JsonRpcEngine } from '@metamask/json-rpc-engine'
import type { JsonRpcRequest } from '@metamask/utils'
import type { ethers } from 'ethers'
import type { ChainConnection } from './types'
import { makePassThroughMiddleware } from './wallet/PassthroughMiddleware'
import { makeAuthorizeMiddleware } from './wallet/AuthorizeMiddleware'
import { makeAccountsMiddleware } from './wallet/AccountsMiddleware'
import { WalletPermissionSystem } from './wallet/WalletPermissionSystem'
import { makeSignMessageMiddleware } from './wallet/SignMessageMiddleware'
import { makeNetworkMiddleware } from './wallet/NetworkMiddleware'

export function makeRpcEngine({
  addNetwork,
  currentChainThunk,
  debug,
  logger,
  emit,
  providerThunk,
  switchNetwork,
  walletThunk,
  walletsThunk,
  waitAuthorization,
  wps,
}: {
  addNetwork: (chainId: number, rpcUrl: string) => void
  currentChainThunk: () => ChainConnection
  debug?: boolean
  emit: (eventName: string, ...args: any[]) => void
  logger?: (message: string) => void
  providerThunk: () => ethers.providers.JsonRpcProvider
  switchNetwork: (chainId_: number) => void
  walletThunk: () => ethers.Wallet
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
  engine.push(makeSignMessageMiddleware(walletThunk))
  engine.push(
    makeNetworkMiddleware(currentChainThunk, addNetwork, switchNetwork)
  )
  engine.push(makePassThroughMiddleware(providerThunk))

  return engine
}
