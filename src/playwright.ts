import type { Page } from '@playwright/test'
import { Web3ProviderConfig } from './Web3ProviderBackend'
import { makeHeadlessWeb3Provider } from './factory'
import { IWeb3Provider } from './types'

type Fn = (...args: any[]) => any

declare global {
  interface Window {
    ethereum: IWeb3Provider
  }
}

export async function injectHeadlessWeb3Provider(
  page: Page,
  privateKeys: string[],
  chainId: number,
  chainRpcUrl: string,
  config?: Web3ProviderConfig
) {
  const evaluate = async <T extends keyof IWeb3Provider>(
    method: T,
    ...args: IWeb3Provider[T] extends Fn ? Parameters<IWeb3Provider[T]> : []
  ) => {
    return page.evaluate(
      ([method, args]) => {
        const ethereum = window.ethereum
        const fn = ethereum[method]
        if (typeof fn == 'function') {
          // @ts-ignore
          return fn.apply(ethereum, args)
        }
        return ethereum[method]
      },
      [method, args] as const
    )
  }

  const web3Provider = makeHeadlessWeb3Provider(
    privateKeys,
    chainId,
    chainRpcUrl,
    evaluate,
    config
  )

  await page.exposeFunction(
    '__injectedHeadlessWeb3ProviderRequest',
    <T extends keyof IWeb3Provider>(
      method: T,
      ...args: IWeb3Provider[T] extends Fn ? Parameters<IWeb3Provider[T]> : []
    ) =>
      // @ts-expect-error
      web3Provider[method](...args)
  )

  const uuid = 'b9838e9f-e9bc-48dd-af0b-6f98949ae677'

  await page.addInitScript(
    (uuid) => {
      class EventEmitter {
        private readonly listeners: Record<
          string,
          Array<(...args: any[]) => void>
        > = Object.create(null)

        emit(eventName: string, ...args: any[]): boolean {
          this.listeners[eventName]?.forEach((listener) => {
            listener(...args)
          })
          return true
        }

        on(eventName: string, listener: (...args: any[]) => void): this {
          this.listeners[eventName] ??= []
          this.listeners[eventName]?.push(listener)
          return this
        }

        off(eventName: string, listener: (...args: any[]) => void): this {
          const listeners = this.listeners[eventName] ?? []

          for (const [i, listener_] of listeners.entries()) {
            if (listener === listener_) {
              listeners.splice(i, 1)
              break
            }
          }

          return this
        }

        once(eventName: string, listener: (...args: any[]) => void): this {
          const cb = (...args: any[]): void => {
            this.off(eventName, cb)
            listener(...args)
          }

          return this.on(eventName, cb)
        }
      }

      const proxyableMethods = ['request']

      // @ts-expect-error
      window.ethereum = new Proxy(new EventEmitter(), {
        get(target: EventEmitter, prop: string): any {
          if (proxyableMethods.includes(prop)) {
            return (...args: any[]) => {
              // @ts-expect-error
              return window.__injectedHeadlessWeb3ProviderRequest(prop, ...args)
            }
          }

          // @ts-expect-error
          return Reflect.get(...arguments)
        },
      })
      window.dispatchEvent(new Event('ethereum#initialized'))

      const event = new CustomEvent('eip6963:announceProvider', {
        detail: Object.freeze({
          info: {
            icon: "data:image/svg+xml,%3Csvg height='99px' width='99px' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 115 182'%3E%3Cpath d='M57.5054 181V135.84L1.64064 103.171L57.5054 181Z' fill='%23F0CDC2' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M57.6906 181V135.84L113.555 103.171L57.6906 181Z' fill='%23C9B3F5' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M57.5055 124.615V66.9786L1 92.2811L57.5055 124.615Z' fill='%2388AAF1' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M57.6903 124.615V66.9786L114.196 92.2811L57.6903 124.615Z' fill='%23C9B3F5' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M1.00006 92.2811L57.5054 1V66.9786L1.00006 92.2811Z' fill='%23F0CDC2' stroke='%231616B4' stroke-linejoin='round'/%3E%3Cpath d='M114.196 92.2811L57.6906 1V66.9786L114.196 92.2811Z' fill='%23B8FAF6' stroke='%231616B4' stroke-linejoin='round'/%3E%3C/svg%3E",
            name: 'Headless Web3 Provider',
            rdns: 'headless-web3-provider',
            uuid: uuid,
          },
          provider: window.ethereum,
        }),
      })

      window.dispatchEvent(event)

      const handler = () => window.dispatchEvent(event)
      window.addEventListener('eip6963:requestProvider', handler)
      return () =>
        window.removeEventListener('eip6963:requestProvider', handler)
    },
    [uuid]
  )

  return web3Provider
}
