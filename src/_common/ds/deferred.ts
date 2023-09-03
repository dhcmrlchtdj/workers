export class Deferred<T = void> {
	promise: Promise<T>
	isFulfilled: boolean
	isResolved: boolean
	isRejected: boolean
	resolve!: (payload: T | PromiseLike<T>) => void
	reject!: (err?: unknown) => void
	constructor() {
		this.isFulfilled = false
		this.isResolved = false
		this.isRejected = false
		this.promise = new Promise((resolve, reject) => {
			this.resolve = (payload: T | PromiseLike<T>) => {
				if (this.isFulfilled) return
				this.isFulfilled = true
				this.isResolved = true
				resolve(payload)
			}
			this.reject = (err?: unknown) => {
				if (this.isFulfilled) return
				this.isFulfilled = true
				this.isRejected = true
				reject(err)
			}
		})
	}
}

const noop = () => {}

export function abortedBySignal<T>(
	d: Deferred<T>,
	signal?: AbortSignal | undefined,
) {
	if (signal) {
		if (signal.aborted) {
			d.reject(signal.reason)
		} else {
			const cb = () => d.reject(signal.reason)
			signal.addEventListener("abort", cb, { once: true })
			d.promise
				.finally(() => signal.removeEventListener("abort", cb))
				.catch(noop) // prevent `unhandledRejection`
		}
	}
}
