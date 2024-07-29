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
	type TransactionRequestBase,
	createWalletClient,
} from 'viem'
import type { ChainTransport } from '../types.js'

type JsonRpcTx = {
	from: Address
	to: Address
	value: Hex
	gasLimit: Hex
	gasPrice: Hex
	type: Hex
	maxFeePerGas?: Hex
	maxPriorityFeePerGas?: Hex
}

const jsonRpctxTypeToViemTxType = (txType: Hex): 'legacy' | undefined => {
	switch (txType) {
		case '0x0':
			return 'legacy'
		default:
			return undefined
	}
}

export const toViemTx = (tx: JsonRpcTx): TransactionRequest<bigint> => {
	// @ts-expect-error too lazy to figure out type error
	return {
		...tx,
		from: tx.from,
		to: tx.to,
		value: BigInt(tx.value),
		gas: BigInt(tx.gasLimit),
		gasPrice: BigInt(tx.gasPrice),
		type: jsonRpctxTypeToViemTxType(tx.type),
		maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
		maxPriorityFeePerGas: tx.maxPriorityFeePerGas
			? BigInt(tx.maxPriorityFeePerGas)
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

					console.log(jsonRpcTx)

					const tx = await createWalletClient({
						account,
						chain: getChain(),
						transport: getChainTransport,
					}).sendTransaction(toViemTx(jsonRpcTx))

					res.result = tx
					break
				}

				default:
					void next()
			}
		})

	return middleware
}
