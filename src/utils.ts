export enum Web3RequestKind {
  RequestAccounts = 'eth_requestAccounts',
  Accounts = 'eth_accounts',
  SendTransaction = 'eth_sendTransaction',
  SwitchEthereumChain = 'wallet_switchEthereumChain',
  AddEthereumChain = 'wallet_addEthereumChain',
}
