export function getAnvilInstance({
	workerIndex,
}: {
	workerIndex: number
}): {
	rpcUrl: string
	restart: () => Promise<Response>
} {
	return {
		rpcUrl: `http://localhost:3077/${workerIndex}`,
		restart: () => fetch(`http://localhost:3077/${workerIndex}/restart`),
	}
}
