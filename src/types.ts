import type {
	EIP1193Parameters,
	EIP1193Provider,
	EIP1474Methods,
	Transport,
} from 'viem'

import type { Web3ProviderBackendType } from './Web3ProviderBackend.js'

export type JsonRpcRequest = EIP1193Parameters<EIP1474Methods>

export interface PendingRequest {
	requestInfo: JsonRpcRequest
	reject: (err: { message?: string; code?: number }) => void
	authorize: () => Promise<void>
}

export type AnyFunction = (...args: any[]) => any
export type EvaluateFn = <T extends keyof Web3ProviderBackendType>(
	method: T,
	...args: Web3ProviderBackendType[T] extends AnyFunction
		? Parameters<Web3ProviderBackendType[T]>
		: []
) => Promise<void>

export type ChainTransport = ReturnType<Transport>

export type WindowEthereum = Window &
	typeof globalThis & { ethereum: EIP1193Provider }
