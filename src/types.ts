import type { EIP1193Parameters, EIP1474Methods } from 'viem/types/eip1193'

export type JsonRpcRequest = EIP1193Parameters<EIP1474Methods>

export interface PendingRequest {
	requestInfo: JsonRpcRequest
	reject: (err: { message?: string; code?: number }) => void
	authorize: () => Promise<void>
}

export interface IWeb3Provider {
	isMetaMask?: boolean

	request(args: JsonRpcRequest): Promise<any>

	emit(eventName: string, ...args: unknown[]): void
	on(eventName: string, listener: (eventName: string) => void): void
}
