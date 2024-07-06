import {
	createAsyncMiddleware,
	type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import type { Chain } from 'viem'
import type { Hex } from 'viem'

export function makeNetworkMiddleware(
	currentChain: Chain,
	addNetwork: (chain: Chain) => void,
	switchNetwork: (chainId: number) => void,
) {
	const middleware: JsonRpcMiddleware<any[], Hex | number | null> =
		createAsyncMiddleware(async (req, res, next) => {
			switch (req.method) {
				case 'eth_chainId': {
					res.result = `0x${currentChain.id.toString(16)}`
					break
				}

				case 'net_version': {
					res.result = currentChain.id
					break
				}

				case 'wallet_addEthereumChain': {
					const chainId = Number(req.params?.[0]?.chainId)
					const rpcUrl = req.params?.[0].chainId
					addNetwork({
						id: chainId,
						rpcUrls: { default: { http: rpcUrl } },
						name: 'test chain',
						nativeCurrency: {
							name: 'test currency',
							symbol: 'ETH',
							decimals: 10,
						},
					})

					res.result = null
					break
				}

				case 'wallet_switchEthereumChain': {
					const chainId = currentChain.id

					// @ts-expect-error todo: parse params
					if (chainId !== Number(req.params[0].chainId)) {
						// @ts-expect-error todo: parse params
						const chainId = Number(req.params[0].chainId)
						switchNetwork(chainId)
					}

					res.result = null
					break
				}

				default:
					void next()
			}
		})

	return middleware
}
