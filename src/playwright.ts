import type { Page } from '@playwright/test'
import { makeHeadlessWeb3Provider } from './factory'
import { IWeb3Provider } from './types'

export async function injectHeadlessWeb3Provider(
  page: Page,
  privateKeys: string[],
  chainId: number,
  chainRpcUrl: string
) {
  const evaluate = async <T extends keyof IWeb3Provider>(
    method: T,
    ...args: Parameters<IWeb3Provider[T]>
  ) => {
    return page.evaluate(
      ([method, args]) => {
        const ethereum = (window as any).ethereum as IWeb3Provider
        // @ts-expect-error
        ethereum[method](...args)
      },
      [method, args] as const
    )
  }

  const web3Provider = makeHeadlessWeb3Provider(
    privateKeys,
    chainId,
    chainRpcUrl,
    evaluate
  )

  await page.exposeFunction(
    '__injectedHeadlessWeb3ProviderRequest',
    <T extends keyof IWeb3Provider>(
      method: T,
      ...args: Parameters<IWeb3Provider[T]>
    ) =>
      // @ts-expect-error
      web3Provider[method](...args)
  )

  await page.addInitScript(() => {
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

    // @ts-expect-error
    window.ethereum.on('accountsChanged', console.log)
  })

  return web3Provider
}
