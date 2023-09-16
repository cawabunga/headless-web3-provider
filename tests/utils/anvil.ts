import { spawn } from 'node:child_process'
import { providers } from 'ethers'

const shutdownSymbol = Symbol('shutdown')

export type ChainInstance = Awaited<ReturnType<typeof forkChain>>

export async function forkChain(getPort: () => Promise<number>) {
  const port = await getPort()
  const rpcUrl = `http://127.0.0.1:${port}`

  const shutdown = await startDevChain(port)

  return {
    rpcUrl: rpcUrl,
    [shutdownSymbol]: shutdown,
  }
}

async function startDevChain(port: number) {
  return new Promise<() => Promise<void>>(async (resolve, reject) => {
    const anvil = spawn('anvil', ['--port', port.toString()])

    anvil.stderr.on('data', (err) => {
      reject(new Error(err.toString()))
    })

    // Wait for the chain to start
    const jsonRpcProvider = new providers.JsonRpcProvider(
      `http://127.0.0.1:${port}`
    )

    while (true) {
      try {
        await jsonRpcProvider.getBlockNumber()
        break
      } catch (err) {
        // avoid busy loop
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    resolve(async () => {
      while (!anvil.killed) {
        anvil.kill()
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    })
  })
}

export async function stopChain(instance: ChainInstance) {
  await instance[shutdownSymbol]()
}
