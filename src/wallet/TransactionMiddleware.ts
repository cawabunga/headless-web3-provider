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
	createWalletClient,
	hexToBigInt,
} from 'viem'
import type { ChainTransport } from '../types.js'

type JsonRpcTx = {
	from: Address
	to: Address
	value: Hex
	gasLimit: Hex
	gasPrice?: Hex
	type: Hex
	maxFeePerGas?: Hex
	maxPriorityFeePerGas?: Hex
}

export const toViemTx = (tx: JsonRpcTx): TransactionRequest => {
	const base = {
		from: tx.from,
		to: tx.to,
		value: hexToBigInt(tx.value),
		gas: hexToBigInt(tx.gasLimit),
	}

	if (tx.type === '0x0') {
		return {
			...base,
			type: 'legacy',
			gasPrice: hexToBigInt(tx.gasPrice!),
		} as TransactionRequest
	}
	return {
		...base,
		type: 'eip1559',
		maxFeePerGas: tx.maxFeePerGas ? hexToBigInt(tx.maxFeePerGas) : undefined,
		maxPriorityFeePerGas: tx.maxPriorityFeePerGas
			? hexToBigInt(tx.maxPriorityFeePerGas)
			: undefined,
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
	const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
		createAsyncMiddleware(async (req, res, next) => {
			switch (req.method) {
				case 'eth_sendTransaction': {
					// @ts-expect-error todo: parse params
					const jsonRpcTx = req.params[0] as JsonRpcTx

					let viemTx!: TransactionRequest
					try {
						viemTx = toViemTx(jsonRpcTx)
					} catch (e) {
						console.error('Error parsing tx', e)
					}

					const tx = await createWalletClient({
						account,
						chain: getChain(),
						transport: getChainTransport,
					}).sendTransaction(viemTx)

					res.result = tx
					break
				}

				default:
					void next()
			}
		})

	return middleware
}
