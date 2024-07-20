export function getAnvilInstance(): {
	rpcUrl: string
	restart: () => Promise<Response>
} {
	return {
		rpcUrl: 'http://localhost:3077/1',
		restart: () => fetch('http://localhost:3077/1/restart'),
	}
}
