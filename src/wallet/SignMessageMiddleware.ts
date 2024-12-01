import {
  createAsyncMiddleware,
  type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import type { Json, JsonRpcParams } from '@metamask/utils'
import { signTypedData, SignTypedDataVersion } from '@metamask/eth-sig-util'
import { ethers } from 'ethers'
import assert from 'node:assert/strict'

export function makeSignMessageMiddleware(walletThunk: () => ethers.Wallet) {
  const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
    createAsyncMiddleware(async (req, res, next) => {
      switch (req.method) {
        case 'personal_sign': {
          const wallet = walletThunk()
          const address = await wallet.getAddress()
          // @ts-expect-error todo: parse params
          assert.equal(address, ethers.utils.getAddress(req.params[1]))

          /**
           * It's important to split hex strings into bytes, because `wallet.signMessage`
           * won't properly handle hex strings which are not UTF-8 encoded.
           * Caution: MetaMask dApp doesn't have singing non-UTF-8 string, so no test for this case.
           */
          // @ts-expect-error todo: parse params
          const message = ethers.utils.arrayify(req.params[0])

          const signature = await wallet.signMessage(message)

          res.result = signature
          break
        }

        case 'eth_signTypedData':
        case 'eth_signTypedData_v1': {
          const wallet = walletThunk()
          const address = await wallet.getAddress()
          // @ts-expect-error todo: parse params
          assert.equal(address, ethers.utils.getAddress(req.params[1]))

          // @ts-expect-error todo: parse params
          const msgParams = req.params[0]

          const signature = signTypedData({
            privateKey: Buffer.from(wallet.privateKey.slice(2), 'hex'),
            data: msgParams,
            version: SignTypedDataVersion.V1,
          })

          res.result = signature
          break
        }

        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4': {
          const wallet = walletThunk()
          const address = await wallet.getAddress()
          // @ts-expect-error todo: parse params
          assert.equal(address, ethers.utils.getAddress(req.params[0]))

          // @ts-expect-error todo: parse params
          const msgParams = JSON.parse(req.params[1])

          const signature = signTypedData({
            privateKey: Buffer.from(wallet.privateKey.slice(2), 'hex'),
            data: msgParams,
            version:
              req.method === 'eth_signTypedData_v4'
                ? SignTypedDataVersion.V4
                : SignTypedDataVersion.V3,
          })

          res.result = signature
          break
        }

        default:
          void next()
      }
    })

  return middleware
}
