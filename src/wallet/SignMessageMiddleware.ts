import {
  createAsyncMiddleware,
  type JsonRpcMiddleware,
} from '@metamask/json-rpc-engine'
import { type Json, type JsonRpcParams } from '@metamask/utils'
import { signTypedData, SignTypedDataVersion } from '@metamask/eth-sig-util'
import { ethers } from 'ethers'
import assert from 'node:assert/strict'
import { isHexString, toUtf8String } from 'ethers/lib/utils'

export function makeSignMessageMiddleware(walletThunk: () => ethers.Wallet) {
  const middleware: JsonRpcMiddleware<JsonRpcParams, Json> =
    createAsyncMiddleware(async (req, res, next) => {
      switch (req.method) {
        case 'personal_sign': {
          const wallet = walletThunk()
          const address = await wallet.getAddress()
          // @ts-expect-error todo: parse params
          assert.equal(address, ethers.utils.getAddress(req.params[1]))

          // @ts-expect-error todo: parse params
          let message = req.params[0];
          // check if message is a 32 bytes hash
          if (isHexString(message, 32)) {
            res.result = await wallet.signMessage(message)
          } else {
            // @ts-expect-error todo: parse params
            message = toUtf8String(req.params[0])

            const signature = await wallet.signMessage(message)

            res.result = signature
          }
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
