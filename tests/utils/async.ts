/**
 * This function is used to limit the number of concurrent calls to a function.
 * Example:
 * ```ts
 *  const limitTask = limitConcurrency(2)
 *  await Promise.all([
 *    limitTask(() => fetch('https://example.com'))(),
 *    limitTask(() => fetch('https://example.com'))(),
 *    limitTask(() => fetch('https://example.com'))(),
 *    limitTask(() => fetch('https://example.com'))(),
 *  ])
 *  ```
 *  @param maxConcurrency The maximum number of concurrent calls to the function.
 *  @returns A function that can be used to limit the number of concurrent calls to a function.
 */
export function limitConcurrency(maxConcurrency: number) {
  let activeCalls = 0
  const pendingCalls: Array<() => void> = []

  const limit = <T extends any[], R extends any>(
    fn: (...args: T) => Promise<R>
  ): ((...args: T) => Promise<R>) => {
    return async (...args: T) => {
      if (activeCalls >= maxConcurrency) {
        await new Promise<void>((resolve) => {
          pendingCalls.push(resolve)
        })
      }
      try {
        activeCalls++
        return await fn(...args)
      } finally {
        activeCalls--
        if (pendingCalls.length > 0) {
          const next = pendingCalls.shift()
          if (next !== undefined) {
            next()
          }
        }
      }
    }
  }

  return limit
}
