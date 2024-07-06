import type { EIP1193Parameters, EIP1474Methods } from "viem/types/eip1193";

export interface PendingRequest {
  requestInfo: EIP1193Parameters<EIP1474Methods>
  reject: (err: { message?: string; code?: number }) => void
  authorize: () => Promise<void>
}

export interface IWeb3Provider {
  isMetaMask?: boolean

  request(args: EIP1193Parameters<EIP1474Methods>): Promise<any>

  emit(eventName: string, ...args: any[]): void
  on(eventName: string, listener: (eventName: string) => void): void
}