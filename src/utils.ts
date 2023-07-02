export enum Web3RequestKind {
  RequestAccounts = 'eth_requestAccounts',
  Accounts = 'eth_accounts',
  SendTransaction = 'eth_sendTransaction',
  SwitchEthereumChain = 'wallet_switchEthereumChain',
  AddEthereumChain = 'wallet_addEthereumChain',
  SignMessage = 'personal_sign',
  SignTypedData = 'eth_signTypedData',
  SignTypedDataV1 = 'eth_signTypedData_v1',
  SignTypedDataV3 = 'eth_signTypedData_v3',
  SignTypedDataV4 = 'eth_signTypedData_v4',
}
