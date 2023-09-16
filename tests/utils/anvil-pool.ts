/**
 * Need anvil instance? Use anvilPool.acquire()
 * ```ts
 * import { anvilPool } from './anvil-pool'
 *
 * const anvilInstance = await anvilPool.acquire()
 *
 * try {
 *   // do stuff with 'anvilInstance.rpcUrl'
 * } finally {
 *   await anvilPool.destroy(anvilInstance)
 * }
 * ```
 */

import { Socket } from 'node:net'
import genericPool from 'generic-pool'
import { limitConcurrency } from './async'
import { ChainInstance, forkChain, stopChain } from './anvil'

const startPort = 8546
const endPort = 8646 // 100 ports
let prevPort = 8545
const getPortLimited = limitConcurrency(1)(async () => {
  const port = await getNextPort(
    clampOrDefault(startPort, endPort, prevPort + 1)
  )
  prevPort = port
  return port
})

export const anvilPool = genericPool.createPool(
  {
    create: function () {
      return forkChain(getPortLimited)
    },
    destroy: async function (instance: ChainInstance) {
      await stopChain(instance)
    },
  },
  {
    min: 3,
    max: 10,
    autostart: true,
  }
)

async function getNextPort(port: number) {
  port = port % 65536 // don't go over 65535 (max port number)

  return new Promise<number>((resolve, reject) => {
    return resolve(port) // bun fails to connect to the port, so we just skip this check

    const socket = new Socket()

    const timeout = () => {
      resolve(port)
      socket.destroy()
    }

    const next = () => {
      socket.destroy()
      resolve(getNextPort(++port))
    }

    setTimeout(timeout, 10)
    socket.on('timeout', timeout)

    socket.on('connect', () => next())

    socket.on('error', (error: unknown) => {
      if ((error as any).code !== 'ECONNREFUSED') {
        reject(error)
      } else {
        resolve(port)
      }
    })

    socket.connect(port, '0.0.0.0')
  })
}

function clampOrDefault(start: number, end: number, number: number) {
  return number >= start && number <= end ? number : start
}
