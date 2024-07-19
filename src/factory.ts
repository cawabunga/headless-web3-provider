import type { EIP1193Provider, Hex } from 'viem'
import type { EventEmitter } from './EventEmitter'
import {
	Web3ProviderBackend,
	type Web3ProviderConfig,
} from './Web3ProviderBackend'
import type { Chain } from 'viem'

type Fn = (...args: any[]) => any

export function makeHeadlessWeb3Provider(
	privateKeys: Hex[],
	chain: Chain,
	evaluate: <T extends keyof EIP1193Provider>(
		method: T,
		...args: EIP1193Provider[T] extends Fn ? Parameters<EIP1193Provider[T]> : []
	) => Promise<void> = async () => {},
	config?: Web3ProviderConfig,
) {
	const web3Provider = new Web3ProviderBackend(privateKeys, [chain], config)

	relayEvents(web3Provider, evaluate)

	return web3Provider
}

function relayEvents(
	eventEmitter: EventEmitter,
	execute: <T extends keyof EIP1193Provider>(
		method: T,
		...args: EIP1193Provider[T] extends Fn ? Parameters<EIP1193Provider[T]> : []
	) => Promise<void>,
): void {
	const emit_ = eventEmitter.emit
	eventEmitter.emit = (eventName, ...args) => {
		// @ts-expect-error
		void execute('emit', eventName, ...args)
		return emit_.apply(eventEmitter, [eventName, ...args])
	}
}
