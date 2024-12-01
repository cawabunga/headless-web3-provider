// https://eips.ethereum.org/EIPS/eip-6963

// todo: fill in the types, and move the types to a separate file; IWeb3Provider should extend EIP1193Provider
export interface EIP1193Provider {}

/**
 * Represents the assets needed to display a wallet
 */
export interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: EIP1193Provider
}

// Announce Event dispatched by a Wallet
export interface EIP6963AnnounceProviderEvent extends CustomEvent {
  type: 'eip6963:announceProvider'
  detail: EIP6963ProviderDetail
}

// Request Event dispatched by a DApp
export interface EIP6963RequestProviderEvent extends Event {
  type: 'eip6963:requestProvider'
}

export const EIP6963_EVENTS = {
  ANNOUNCE_PROVIDER: 'eip6963:announceProvider',
  REQUEST_PROVIDER: 'eip6963:requestProvider',
}

export const EIP6963_PROVIDER_INFO = {
  icon: "data:image/svg+xml,%3Csvg height='99px' width='99px' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 115 182'%3E%3Cpath d='M57.5054 181V135.84L1.64064 103.171L57.5054 181Z' fill='%23F0CDC2' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M57.6906 181V135.84L113.555 103.171L57.6906 181Z' fill='%23C9B3F5' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M57.5055 124.615V66.9786L1 92.2811L57.5055 124.615Z' fill='%2388AAF1' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M57.6903 124.615V66.9786L114.196 92.2811L57.6903 124.615Z' fill='%23C9B3F5' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M1.00006 92.2811L57.5054 1V66.9786L1.00006 92.2811Z' fill='%23F0CDC2' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M114.196 92.2811L57.6906 1V66.9786L114.196 92.2811Z' fill='%23B8FAF6' stroke='%231616B4' stroke-linejoin='round'/%3E%3C/svg%3E",
  name: 'Headless Web3 Provider',
  rdns: 'headless-web3-provider',
  uuid: 'b9838e9f-e9bc-48dd-af0b-6f98949ae677',
}
