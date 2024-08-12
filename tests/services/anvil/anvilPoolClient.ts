export function getAnvilInstance({
	workerIndex,
}: {
	workerIndex: number
}): {
	rpcUrl: string
	restart: () => Promise<Response>
} {
	const instanceIndex = workerIndex + 1
	return {
		rpcUrl: `http://localhost:3077/${instanceIndex}`,
		restart: () => fetch(`http://localhost:3077/${instanceIndex}/restart`),
	}
}
