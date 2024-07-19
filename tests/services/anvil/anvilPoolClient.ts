import { Socket } from 'node:net'

export function getAnvilInstance(): Promise<{
	rpcUrl: string
	destroy: () => void
}> {
	return new Promise((resolve) => {
		const client = new Socket()

		client.connect(3077, '127.0.0.1', () => {
			client.write(JSON.stringify({ type: 'create' }))

			client.once('data', (data) => {
				const message = JSON.parse(data.toString())
				resolve({
					rpcUrl: message.rpcUrl,
					destroy: () => {
						client.write(
							JSON.stringify({ type: 'destroy', uuid: message.uuid }),
						)
						client.end()
					},
				})
			})
		})
	})
}
