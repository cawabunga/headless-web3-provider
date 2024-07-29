import {
	type JsonRpcMiddleware,
	createAsyncMiddleware,
} from '@metamask/json-rpc-engine'
import type { Json, JsonRpcParams } from '@metamask/utils'
import { hexToString } from 'viem'
import type { LocalAccount } from 'viem/accounts'

export function createSignMessageMiddleware({
	account,
}: { account: LocalAccount }) {
	const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
		createAsyncMiddleware(async (req, res, next) => {
			switch (req.method) {
				case 'personal_sign': {
					// @ts-expect-error
					const message = hexToString(req.params[0])

					const signature = await account.signMessage({ message })

					res.result = signature
					break
				}

				case 'eth_signTypedData_v3':
				case 'eth_signTypedData_v4': {
					// @ts-expect-error todo: parse params
					const msgParams = JSON.parse(req.params[1])

					const signature = await account.signTypedData(msgParams)

					res.result = signature
					break
				}

				default:
					void next()
			}
		})

	return middleware
}
