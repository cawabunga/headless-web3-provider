export class EventEmitter {
	private readonly listeners: Record<
		string,
		Array<(...args: unknown[]) => void>
	> = Object.create(null)

	emit(eventName: string, ...args: unknown[]): boolean {
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
		const cb = (...args: unknown[]): void => {
			this.off(eventName, cb)
			listener(...args)
		}

		return this.on(eventName, cb)
	}

	removeListener = this.off
}
