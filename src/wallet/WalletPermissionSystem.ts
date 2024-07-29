// EIP-2255: Wallet Permissions System (https://eips.ethereum.org/EIPS/eip-2255)

import type { Web3RequestKind } from '../utils'

// Caveat for `eth_accounts` could be:
// { "type": "requiredMethods", "value": ["signTypedData_v3"] }
interface Caveat {
	type: string
	value: any // JSON object, meaning depends on the caveat type
}

interface Permission {
	invoker: string // DApp origin
	parentCapability: string // RPC method name
	caveats: Caveat[]
}

type ShorthandPermission = Web3RequestKind | string

export class WalletPermissionSystem {
	#permissions: Map<string, Permission[]> = new Map()
	#wildcardOrigin = '*'

	constructor(perms: ShorthandPermission[] = []) {
		this.#permissions.set(
			this.#wildcardOrigin,
			perms.map((perm) => ({
				invoker: this.#wildcardOrigin,
				parentCapability: perm,
				caveats: [],
			})),
		)
	}

	/**
	 * @param rpcMethod
	 * @param origin not used in the current implementation, empty string can be passed
	 */
	permit(rpcMethod: Web3RequestKind | string, origin: string) {
		const permissions = this.#permissions.get(origin) || []

		const updatedPermissions = permissions.filter(
			(permission) => permission.parentCapability !== rpcMethod,
		)
		updatedPermissions.push({
			invoker: origin,
			parentCapability: rpcMethod,
			caveats: [], // Caveats are not implemented
		})

		console.log('updatedPermissions', updatedPermissions)

		this.#permissions.set(origin, updatedPermissions)
	}

	/**
	 * @param rpcMethod
	 * @param origin not used in the current implementation, empty string can be passed
	 */
	revoke(rpcMethod: Web3RequestKind | string, origin: string) {
		const permissions = this.#permissions.get(origin) || []
		const updatedPermissions = permissions.filter(
			(permission) => permission.parentCapability !== rpcMethod,
		)
		this.#permissions.set(origin, updatedPermissions)
	}

	/**
	 * @param rpcMethod
	 * @param origin not used in the current implementation, empty string can be passed
	 */
	isPermitted(rpcMethod: Web3RequestKind | string, origin: string): boolean {
		const permissions = this.#permissions.get(origin) || []
		const wildcardPermissions =
			this.#permissions.get(this.#wildcardOrigin) || []

		console.log(
			rpcMethod,
			permissions.some(
				(permission) => permission.parentCapability === rpcMethod,
			) ||
				wildcardPermissions.some(
					(permission) => permission.parentCapability === rpcMethod,
				),
		)

		return (
			permissions.some(
				(permission) => permission.parentCapability === rpcMethod,
			) ||
			wildcardPermissions.some(
				(permission) => permission.parentCapability === rpcMethod,
			)
		)
	}
}
