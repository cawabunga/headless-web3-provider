import { definePool } from 'prool'
import { anvil } from 'prool/instances'

const server = definePool({
	instance: anvil(),
})

export const anvilInstance = await server.start(1, { port: 8545 })
