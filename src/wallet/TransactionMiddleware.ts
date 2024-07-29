import {
	type JsonRpcMiddleware,
	createAsyncMiddleware,
} from '@metamask/json-rpc-engine'
import type { Json, JsonRpcParams } from '@metamask/utils'
import {
	type Address,
	type Chain,
	type Hex,
	type LocalAccount,
	type TransactionRequest,
	createPublicClient,
	createWalletClient,
	hexToBigInt,
} from 'viem'
import type { ChainTransport } from '../types.js'

type TxBase = {
	type?: Hex
	from: Address
	to: Address
	value: Hex
	gasLimit: Hex
}

type LegacyTx = TxBase & { type: '0x0'; gasPrice: Hex }
type EIP1559Tx = TxBase & {
	maxFeePerGas: Hex
	maxPriorityFeePerGas: Hex
}

function isLegacyTransaction(tx: LegacyTx | EIP1559Tx): tx is LegacyTx {
	return tx.type === '0x0'
}

export const toViemTx = (tx: LegacyTx | EIP1559Tx): TransactionRequest => {
	const base = {
		from: tx.from,
		to: tx.to,
		value: hexToBigInt(tx.value),
		gas: hexToBigInt(tx.gasLimit),
	}

	if (isLegacyTransaction(tx)) {
		return {
			...base,
			type: 'legacy',
			gasPrice: hexToBigInt(tx.gasPrice),
		} as TransactionRequest
	}
	return {
		...base,
		type: 'eip1559',
		maxFeePerGas: hexToBigInt(tx.maxFeePerGas),
		maxPriorityFeePerGas: hexToBigInt(tx.maxPriorityFeePerGas),
	}
}

export function createTransactionMiddleware({
	getChain,
	account,
	getChainTransport,
}: {
	getChain: () => Chain
	account: LocalAccount
	getChainTransport: () => ChainTransport
}) {
	const walletClient = createWalletClient({
		account,
		chain: getChain(),
		transport: getChainTransport,
	})
	const publicClient = createPublicClient({
		chain: getChain(),
		transport: getChainTransport,
	})
	const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
		createAsyncMiddleware(async (req, res, next) => {
			switch (req.method) {
				case 'eth_sendTransaction': {
					// @ts-expect-error todo: parse params
					const jsonRpcTx = req.params[0] as JsonRpcTx

					let viemTx: TransactionRequest
					try {
						viemTx = toViemTx(jsonRpcTx)
					} catch (e) {
						console.error('Error parsing tx', e)
						throw e
					}

					try {
						const estimatedGasLimit = await publicClient.estimateGas(viemTx)

						res.result = await walletClient.sendTransaction({
							...viemTx,
							// I'm not sure why a submitted tx gas has a gas value below 21K so we cap it here
							gas: viemTx.gas
								? estimatedGasLimit > viemTx.gas
									? estimatedGasLimit
									: viemTx.gas
								: undefined,
						})
					} catch (e) {
						console.error('Error submitting transaction', e, viemTx)
					}

					break
				}

				default:
					void next()
			}
		})

	return middleware
}
