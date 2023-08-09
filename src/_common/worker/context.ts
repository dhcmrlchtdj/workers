import { AsyncLocalStorage } from "node:async_hooks"

export const asyncContext = new AsyncLocalStorage<Map<string, unknown>>()

export function getInContext<T = unknown>(key: string): T {
	const ctx = asyncContext.getStore()
	if (!ctx) throw new Error("use: invalid context")
	if (!ctx.has(key)) throw new Error("use: not exist")
	return ctx.get(key) as T
}

export function setInContext(key: string, value: unknown) {
	const ctx = asyncContext.getStore()
	if (!ctx) throw new Error("use: invalid context")
	ctx.set(key, value)
}

export function hasInContext(key: string): boolean {
	const ctx = asyncContext.getStore()
	if (!ctx) throw new Error("use: invalid context")
	return ctx.has(key)
}

export function delInContext(key: string): boolean {
	const ctx = asyncContext.getStore()
	if (!ctx) throw new Error("use: invalid context")
	return ctx.delete(key)
}

///

export function addServerTiming(name: string, desc?: string) {
	const start = Date.now()
	return () => {
		const dur = Date.now() - start

		let value = name
		if (desc) value += `;desc="${desc}"`
		value += ";dur=" + dur

		const key = "__ServerTiming__"
		if (hasInContext(key)) {
			const prevKey = getInContext<string>(key)
			value = prevKey + ", " + value
		}
		setInContext(key, value)
	}
}
