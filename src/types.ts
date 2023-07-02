export interface IWeb3Provider {
  isMetaMask?: boolean

  request(args: { method: 'eth_accounts'; params: [] }): Promise<string[]>
  request(args: {
    method: 'eth_requestAccounts'
    params: []
  }): Promise<string[]>
  request(args: { method: 'net_version'; params: [] }): Promise<number>
  request(args: { method: 'eth_chainId'; params: [] }): Promise<string>
  request(args: { method: 'personal_sign'; params: string[] }): Promise<string>
  request(args: {
    method: 'eth_signTypedData' | 'eth_signTypedData_v1'
    params: [object[], string]
  }): Promise<string>
  request(args: {
    method: 'eth_signTypedData_v3' | 'eth_signTypedData_v4'
    params: string[]
  }): Promise<string>
  request(args: { method: string; params?: any[] }): Promise<any>

  emit(eventName: string, ...args: any[]): void
  on(eventName: string, listener: (eventName: string) => void): void
}

export interface PendingRequest {
  requestInfo: { method: string; params: any[] }
  reject: (err: { message?: string; code?: number }) => void
  authorize: () => Promise<void>
}
