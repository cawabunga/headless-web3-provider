export interface IWeb3Provider {
  request(args: { method: 'eth_accounts'; params: string[] }): Promise<string[]>
  request(args: {
    method: 'eth_requestAccounts'
    params: string[]
  }): Promise<string[]>
  request(args: { method: 'eth_chainId'; params: string[] }): Promise<string>
  request(args: { method: 'personal_sign'; params: string[] }): Promise<string>
  request(args: { method: string; params?: any[] }): Promise<any>

  emit(eventName: string, ...args: any[]): void

  on(eventName: string, listener: (eventName: string) => void): void
}

export interface PendingRequest {
  requestInfo: { method: string; params: any[] }
  reject: (err: { message?: string; code?: number }) => void
  authorize: () => Promise<void>
}
