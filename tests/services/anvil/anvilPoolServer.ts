import { randomUUID } from 'node:crypto'
import { createServer } from 'net'
import { anvilPool } from './anvilPool'
import { ChainInstance } from './anvil'

const server = createServer((socket) => {
  const instances: Record<string, ChainInstance> = {}

  socket.on('data', (data) => {
    const message = JSON.parse(data.toString())

    switch (message.type) {
      case 'create':
        anvilPool.acquire().then((anvilInstance) => {
          const uuid = randomUUID()
          instances[uuid] = anvilInstance
          socket.write(JSON.stringify({ uuid, rpcUrl: anvilInstance.rpcUrl }))
        })
        break

      case 'destroy':
        const instance = instances[message.uuid]
        delete instances[message.uuid]
        anvilPool.destroy(instance)
        break
    }
  })
})

const port = 3077
console.log(`listening on port ${port}`)
server.listen(port)
