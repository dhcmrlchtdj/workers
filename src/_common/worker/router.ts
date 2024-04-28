import { HttpNotFound } from "../http/status.ts"
import { asyncContext } from "./context.ts"
import type { Handler, Matcher, NextFn, RouterContext } from "./type.ts"

type NonEmptyArray<T> = [T, ...T[]]

type Route<ENV> = {
	matcher: Matcher<ENV>
	handlers: Handler<ENV>[]
}

export class Router<ENV> {
	private _route: Route<ENV>[]

	constructor() {
		this._route = []
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
	): ReturnType<Handler<ENV>> {
		const gen = routeGenerator(this._route)
		gen.next() // init
		const next: NextFn<ENV> = (ctx) => {
			const route = gen.next(ctx)
			if (route.done) return HttpNotFound()
			const { handler, param } = route.value
			return handler({ ...ctx, param }, next)
		}
		const ctx = { req, env, ec, param: new Map() }
		return asyncContext.run(new Map(), next, ctx)
	}
}

function* routeGenerator<ENV>(route: Route<ENV>[]): Generator<
	{
		handler: Handler<ENV>
		param: Map<string, string>
	},
	void,
	RouterContext<ENV>
> {
	// @ts-expect-error
	let ctx = yield // init
	for (let i = 0; i < route.length; i++) {
		const { matcher, handlers } = route[i]!
		if (handlers.length === 0) continue
		const param = matcher(ctx)
		if (!param) continue
		for (let j = 0; j < handlers.length; j++) {
			ctx = yield { handler: handlers[j]!, param }
		}
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
		if (method && ctx.req.method.toUpperCase() !== method) return null
		return matchPath(pathPattern, new URL(ctx.req.url).pathname)
	}
}

function matchPath(
	pattern: string,
	pathname: string,
): Map<string, string> | null {
	const param = new Map<string, string>()

	const patternParts = pattern.split("/")
	const patternLen = patternParts.length
	const pathParts = pathname.split("/")
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
