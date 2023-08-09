import { AsyncLocalStorage } from "node:async_hooks"

export const asyncContext = new AsyncLocalStorage<Map<string, unknown>>()

export function getInContext(key: string): unknown {
	const ctx = asyncContext.getStore()
	if (!ctx) throw new Error("use: invalid context")
	if (!ctx.has(key)) throw new Error("use: not exist")
	return ctx.get(key)
}

export function setInContext(key: string, value: unknown) {
	const ctx = asyncContext.getStore()
	if (!ctx) throw new Error("use: invalid context")
	ctx.set(key, value)
}
