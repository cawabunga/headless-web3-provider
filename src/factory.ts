import type { EventEmitter } from './EventEmitter'
import type { EvaluateFn } from './types'
import {
	Web3ProviderBackend,
	type Web3ProviderConfig
} from './Web3ProviderBackend'

type CreateHeadlessWeb3ProviderParameters = Web3ProviderConfig & {
	evaluate?: EvaluateFn,
}

export function createHeadlessWeb3Provider({
	evaluate = async () => {},
	...config
}: CreateHeadlessWeb3ProviderParameters,
) {
	const web3Provider = new Web3ProviderBackend(config)

	relayEvents(web3Provider, evaluate)

	return web3Provider
}

function relayEvents(
	eventEmitter: EventEmitter,
	execute: EvaluateFn,
): void {
	const emit_ = eventEmitter.emit
	eventEmitter.emit = (eventName, ...args) => {
		execute('emit', eventName, ...args)
		return emit_.apply(eventEmitter, [eventName, ...args])
	}
}
