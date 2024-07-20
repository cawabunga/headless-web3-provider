import type { EIP1193Parameters, EIP1474Methods } from 'viem'

export type JsonRpcRequest = EIP1193Parameters<EIP1474Methods>

export interface PendingRequest {
	requestInfo: JsonRpcRequest
	reject: (err: { message?: string; code?: number }) => void
	authorize: () => Promise<void>
}
