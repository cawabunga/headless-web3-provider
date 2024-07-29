import {
	type JsonRpcMiddleware,
	createAsyncMiddleware,
} from '@metamask/json-rpc-engine'
import type { Chain, Hex } from 'viem'

type ChainMiddlewareConfig = {
	getChain: () => Chain
	addChain: (chain: Chain) => void
	switchChain: (chainId: number) => void
}

export function createChainMiddleware({
	getChain,
	addChain,
	switchChain,
}: ChainMiddlewareConfig) {
	const middleware: JsonRpcMiddleware<any[], Hex | number | null> =
		createAsyncMiddleware(async (req, res, next) => {
			switch (req.method) {
				case 'eth_chainId': {
					res.result = `0x${getChain().id.toString(16)}`
					break
				}

				case 'net_version': {
					res.result = getChain().id
					break
				}

				case 'wallet_addEthereumChain': {
					const chainId = Number(req.params?.[0]?.chainId)
					const rpcUrl = req.params?.[0].chainId
					addChain({
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
					const chainId = getChain().id

					// @ts-expect-error todo: parse params
					if (chainId !== Number(req.params[0].chainId)) {
						// @ts-expect-error todo: parse params
						const chainId = Number(req.params[0].chainId)
						switchChain(chainId)
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
