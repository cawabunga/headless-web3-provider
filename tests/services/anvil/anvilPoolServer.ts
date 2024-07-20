import { createServer } from 'prool'
import { anvil } from 'prool/instances'

const server = createServer({
	instance: anvil(),
	port: 3077,
})

await server.start()
