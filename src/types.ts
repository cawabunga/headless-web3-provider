import type { JsonRpcRequest } from '@metamask/utils'

export interface IWeb3Provider {
  isMetaMask?: boolean

  request(args: Pick<JsonRpcRequest, 'method' | 'params'>): Promise<any>

  emit(eventName: string, ...args: any[]): void
  on(eventName: string, listener: (eventName: string) => void): void
}

export interface PendingRequest {
  requestInfo: JsonRpcRequest
  reject: (err: { message?: string; code?: number }) => void
  authorize: () => Promise<void>
}
