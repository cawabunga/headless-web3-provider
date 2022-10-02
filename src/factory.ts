import { ethers } from 'ethers'
import { IWeb3Provider } from './types'
import { EventEmitter } from './EventEmitter'
import { Web3ProviderBackend } from './Web3ProviderBackend'

export function makeHeadlessWeb3Provider(
  privateKeys: string[],
  chainId: number,
  chainRpcUrl: string,
  evaluate: <T extends keyof IWeb3Provider>(
    method: T,
    ...args: Parameters<IWeb3Provider[T]>
  ) => Promise<void> = async () => {}
) {
  const chainRpc = new ethers.providers.JsonRpcProvider(chainRpcUrl, chainId)
  const web3Provider = new Web3ProviderBackend(privateKeys, chainId, chainRpc)

  relayEvents(web3Provider, evaluate)

  return web3Provider
}

function relayEvents(
  eventEmitter: EventEmitter,
  execute: <T extends keyof IWeb3Provider>(
    method: T,
    ...args: Parameters<IWeb3Provider[T]>
  ) => Promise<void>
): void {
  const emit_ = eventEmitter.emit
  eventEmitter.emit = (eventName, ...args) => {
    void execute('emit', eventName, ...args)
    return emit_.apply(eventEmitter, [eventName, ...args])
  }
}
