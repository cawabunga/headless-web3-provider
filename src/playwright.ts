import type { Page } from '@playwright/test'

import { EventEmitter } from './EventEmitter.js'
import type { Web3ProviderConfig } from './backend.js'
import { createHeadlessWeb3Provider } from './factory.js'
import type { EvaluateFn, WindowEthereum } from './types.js'

export type InjectHeadlessWeb3ProviderParameters = Web3ProviderConfig & {
	page: Page
}

export async function injectHeadlessWeb3Provider({
	page,
	...config
}: InjectHeadlessWeb3ProviderParameters) {
	const evaluate: EvaluateFn = async (method, ...args) => {
		return page.evaluate(
			([method, args]) => {
				const ethereum = (window as WindowEthereum).ethereum

				const fn = ethereum[method as keyof typeof ethereum]
				if (typeof fn === 'function') {
					// @ts-expect-error
					return fn.apply(ethereum, args)
				}
				return fn
			},
			[method, args] as const,
		)
	}

	const web3Provider = createHeadlessWeb3Provider({ ...config, evaluate })
	const injectedRequest: EvaluateFn = async (method, ...args) =>
		// @ts-expect-error
		web3Provider[method](...args)

	await page.exposeFunction(
		'__injectedHeadlessWeb3ProviderRequest',
		injectedRequest,
	)

	await page.addInitScript({
		content: `window.EventEmitter = ${EventEmitter.toString()}`,
	})

	const uuid = crypto.randomUUID()

	await page.addInitScript(
		([uuid]) => {
			const proxyableMethods = ['request']

			// @ts-expect-error
			// biome-ignore lint/suspicious/noImportAssign: EventEmitter does not exist in browser context
			EventEmitter = window.EventEmitter

			Object.defineProperty(window, 'ethereum', {
				value: new Proxy(new EventEmitter(), {
					get(target: EventEmitter, prop: string): unknown {
						if (proxyableMethods.includes(prop)) {
							return (...args: unknown[]) => {
								// @ts-expect-error
								return window.__injectedHeadlessWeb3ProviderRequest(
									prop,
									...args,
								)
							}
						}

						return Reflect.get(target, prop)
					},
					set(target: EventEmitter, prop: string, value: unknown): boolean {
						return Reflect.set(target, prop, value)
					},
				}),
			})
			window.dispatchEvent(new Event('ethereum#initialized'))

			const event = new CustomEvent('eip6963:announceProvider', {
				detail: Object.freeze({
					info: {
						icon: "data:image/svg+xml,%3Csvg height='99px' width='99px' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 115 182'%3E%3Cpath d='M57.5054 181V135.84L1.64064 103.171L57.5054 181Z' fill='%23F0CDC2' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M57.6906 181V135.84L113.555 103.171L57.6906 181Z' fill='%23C9B3F5' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M57.5055 124.615V66.9786L1 92.2811L57.5055 124.615Z' fill='%2388AAF1' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M57.6903 124.615V66.9786L114.196 92.2811L57.6903 124.615Z' fill='%23C9B3F5' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M1.00006 92.2811L57.5054 1V66.9786L1.00006 92.2811Z' fill='%23F0CDC2' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M114.196 92.2811L57.6906 1V66.9786L114.196 92.2811Z' fill='%23B8FAF6' stroke='%231616B4' stroke-linejoin='round'/%3E%3C/svg%3E",
						name: 'Headless Web3 Provider',
						rdns: 'headless-web3-provider',
						uuid,
					},
					provider: (window as WindowEthereum).ethereum,
				}),
			})

			window.dispatchEvent(event)

			const handler = () => window.dispatchEvent(event)
			window.addEventListener('eip6963:requestProvider', handler)
		},
		[uuid],
	)

	return web3Provider
}
