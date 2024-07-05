import type { IWeb3Provider } from './types'
import { EventEmitter } from './EventEmitter'
import { Web3ProviderBackend, Web3ProviderConfig } from './Web3ProviderBackend'

type Fn = (...args: any[]) => any

export function makeHeadlessWeb3Provider(
  privateKeys: string[],
  chainId: number,
  rpcUrl: string,
  evaluate: <T extends keyof IWeb3Provider>(
    method: T,
    ...args: IWeb3Provider[T] extends Fn ? Parameters<IWeb3Provider[T]> : []
  ) => Promise<void> = async () => {},
  config?: Web3ProviderConfig
) {
  const web3Provider = new Web3ProviderBackend(
    privateKeys,
    [{ chainId, rpcUrl }],
    config
  )

  relayEvents(web3Provider, evaluate)

  return web3Provider
}

function relayEvents(
  eventEmitter: EventEmitter,
  execute: <T extends keyof IWeb3Provider>(
    method: T,
    ...args: IWeb3Provider[T] extends Fn ? Parameters<IWeb3Provider[T]> : []
  ) => Promise<void>
): void {
  const emit_ = eventEmitter.emit
  eventEmitter.emit = (eventName, ...args) => {
    void execute('emit', eventName, ...args)
    return emit_.apply(eventEmitter, [eventName, ...args])
  }
}
