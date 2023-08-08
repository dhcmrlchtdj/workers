import type { Handler, Matcher, NextFn, RouterContext } from "./type.js"
import { HttpNotFound } from "../http/status.js"

type NonEmptyArray<T> = [T, ...T[]]

export class Router<ENV> {
	private _route: {
		matcher: Matcher<ENV>
		handlers: Handler<ENV>[]
	}[]

	constructor() {
		this._route = [
			{ matcher: () => null, handlers: [] }, // sentinel
		]
	}

	private _addRoute(
		method: Parameters<typeof createMatcher>[0],
		pattern: string | string[],
		handlers: Handler<ENV>[],
	) {
		if (Array.isArray(pattern)) {
			pattern.forEach((p) => {
				this._route.push({
					matcher: createMatcher(method, p),
					handlers,
				})
			})
		} else {
			this._route.push({
				matcher: createMatcher(method, pattern),
				handlers,
			})
		}
	}

	use(pattern: string | string[], ...handlers: NonEmptyArray<Handler<ENV>>) {
		this._addRoute(undefined, pattern, handlers)
	}
	head(pattern: string | string[], ...handlers: NonEmptyArray<Handler<ENV>>) {
		this._addRoute("HEAD", pattern, handlers)
	}
	get(pattern: string | string[], ...handlers: NonEmptyArray<Handler<ENV>>) {
		this._addRoute("GET", pattern, handlers)
	}
	put(pattern: string | string[], ...handlers: NonEmptyArray<Handler<ENV>>) {
		this._addRoute("PUT", pattern, handlers)
	}
	post(pattern: string | string[], ...handlers: NonEmptyArray<Handler<ENV>>) {
		this._addRoute("POST", pattern, handlers)
	}
	del(pattern: string | string[], ...handlers: NonEmptyArray<Handler<ENV>>) {
		this._addRoute("DELETE", pattern, handlers)
	}

	handle(
		req: Request,
		env: ENV,
		ec: ExecutionContext,
	): Response | Promise<Response> {
		let mIdx = 0 // this._route[0] is sentinel
		let hIdx = 0
		const next: NextFn<ENV> = (ctx: RouterContext<ENV>) => {
			hIdx++
			const { handlers } = this._route[mIdx]!
			if (hIdx < handlers.length) {
				const nextHandler = handlers[hIdx]!
				return nextHandler(ctx, next)
			}

			for (mIdx++; mIdx < this._route.length; mIdx++) {
				const { matcher, handlers } = this._route[mIdx]!
				if (handlers.length > 0) {
					const param = matcher(ctx)
					if (param) {
						hIdx = 0
						const nextHandler = handlers[0]!
						return nextHandler({ ...ctx, param }, next)
					}
				}
			}

			return HttpNotFound()
		}
		const ctx = {
			req,
			env,
			ec,
			pathParts: new URL(req.url).pathname.split("/"),
			param: new Map(),
			credential: null,
		}
		return next(ctx)
	}
}

function createMatcher<ENV>(
	method:
		| "CONNECT"
		| "DELETE"
		| "GET"
		| "HEAD"
		| "OPTIONS"
		| "PATCH"
		| "POST"
		| "PUT"
		| "TRACE"
		| undefined,
	pathPattern: string,
): Matcher<ENV> {
	return (ctx: RouterContext<ENV>) => {
		if (method) {
			if (ctx.req.method.toUpperCase() !== method) return null
		}
		return matchPath(pathPattern.split("/"), ctx.pathParts)
	}
}

function matchPath(
	patternParts: string[],
	pathParts: string[],
): Map<string, string> | null {
	const param = new Map<string, string>()

	const patternLen = patternParts.length
	const pathLen = pathParts.length

	let i = 0
	let j = 0
	while (i < patternLen && j < pathLen) {
		const patternPart = patternParts[i]!
		const pathPart = pathParts[j]!
		if (patternPart === "*") {
			const m = pathParts.slice(j).join("/")
			if (m !== "") {
				param.set("*", m)
				i++
				j = pathLen
			} else {
				return null
			}
		} else if (patternPart.startsWith(":")) {
			if (pathPart !== "") {
				param.set(patternPart.slice(1), pathPart)
				i++
				j++
			} else {
				return null
			}
		} else if (patternPart === pathPart) {
			i++
			j++
		} else {
			return null
		}
	}
	if (i !== patternLen || j !== pathLen) {
		return null
	}

	return param
}
