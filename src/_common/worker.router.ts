import * as S from "../_common/http/request.js"
import * as R from "../_common/http/response.js"
import {
	HttpInternalServerError,
	HttpNotFound,
	HttpUnsupportedMediaType,
} from "./http/status.js"
import { TelegramMonitor } from "./service/telegram-monitor.js"

type NonEmptyArray<T> = [T, ...T[]]

type RouterContext<ENV> = {
	req: Request
	env: ENV
	ec: ExecutionContext
	url: URL
	param: Map<string, string>
}

type Matcher<ENV> = (ctx: RouterContext<ENV>) => null | Map<string, string>

type Handler<ENV> = (
	ctx: RouterContext<ENV>,
	next: NextFn<ENV>,
) => Response | Promise<Response>

type NextFn<ENV> = (ctx: RouterContext<ENV>) => Response | Promise<Response>

export class Router<ENV> {
	private _route: [Matcher<ENV>, NonEmptyArray<Handler<ENV>>][]
	constructor() {
		this._route = []
	}

	use(pattern: string, ...handler: NonEmptyArray<Handler<ENV>>) {
		this._route.push([createMatcher(pattern), handler])
	}
	head(pattern: string, ...handler: NonEmptyArray<Handler<ENV>>) {
		this._route.push([createMatcher(pattern, "HEAD"), handler])
	}
	get(pattern: string, ...handler: NonEmptyArray<Handler<ENV>>) {
		this._route.push([createMatcher(pattern, "GET"), handler])
	}
	put(pattern: string, ...handler: NonEmptyArray<Handler<ENV>>) {
		this._route.push([createMatcher(pattern, "PUT"), handler])
	}
	post(pattern: string, ...handler: NonEmptyArray<Handler<ENV>>) {
		this._route.push([createMatcher(pattern, "POST"), handler])
	}

	handle(
		req: Request,
		env: ENV,
		ec: ExecutionContext,
	): Response | Promise<Response> {
		let mIdx = -1
		let hIdx = -1
		let handlers: Handler<ENV>[] = []
		const next: NextFn<ENV> = (ctx: RouterContext<ENV>) => {
			hIdx++
			if (hIdx < handlers.length) {
				const nextHandler = handlers[hIdx]!
				return nextHandler(ctx, next)
			}

			for (mIdx++; mIdx < this._route.length; mIdx++) {
				const [matcher, hs] = this._route[mIdx]!
				if (hs.length > 0) {
					const param = matcher(ctx)
					if (param) {
						hIdx = 0
						handlers = hs
						const nextHandler = handlers[0]!
						return nextHandler(ctx, next)
					}
				}
			}

			return HttpNotFound()
		}
		const ctx = { req, env, ec, url: new URL(req.url), param: new Map() }
		return next(ctx)
	}
}

function createMatcher<ENV>(
	pattern: string,
	method?: "GET" | "HEAD" | "PUT" | "POST" | "DELETE" | "OPTION",
): Matcher<ENV> {
	return (ctx: RouterContext<ENV>) => {
		if (method) {
			if (ctx.req.method.toUpperCase() !== method) return null
		}
		return patternMatch(pattern, ctx.url.pathname)
	}
}

function patternMatch(pattern: string, path: string) {
	const param = new Map<string, string>()
	const patternParts = pattern.split("/")
	const pathParts = path.split("/")

	const patternLen = patternParts.length
	const pathLen = pathParts.length

	let i = 0
	let j = 0
	while (i < patternLen && j < pathLen) {
		const patternPart = patternParts[i]!
		const pathPart = pathParts[j]!
		if (patternPart === "*") {
			param.set("*", pathParts.slice(j).join("/"))
			i++
			j = pathLen
		} else if (patternPart.startsWith(":")) {
			param.set(patternPart.slice(1), pathPart)
			i++
			j++
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

///

export function checkContentType<ENV>(expectedType: string): Handler<ENV> {
	return (ctx, next) => {
		const actualType = ctx.req.headers.get("content-type")
		if (!actualType?.startsWith(expectedType)) {
			return HttpUnsupportedMediaType(`expect "${expectedType}"`)
		}
		return next(ctx)
	}
}

export function cacheResponse<ENV>(): Handler<ENV> {
	return async (ctx, next) => {
		const { req, ec } = ctx
		if (req.method.toUpperCase() !== "GET") {
			return next(ctx)
		}

		// https://developers.cloudflare.com/workers/runtime-apis/cache/#match
		// Cloudflare Workers do not support the `ignoreSearch` or `ignoreVary` options on match()
		const url = new URL(req.url)
		url.search = "" // remove querystring

		const cacheKey = S.build(S.get(url), S.headers(req.headers))
		const cache = caches.default
		const cachedResp = await cache.match(cacheKey)
		if (cachedResp) return cachedResp

		const resp = await next(ctx)

		// https://developers.cloudflare.com/workers/runtime-apis/cache/#invalid-parameters
		if (resp.status === 200) {
			const r = resp.clone()
			r.headers.set("x-worker-cache-status", "HIT")
			ec.waitUntil(cache.put(cacheKey, r))
		}

		resp.headers.set("x-worker-cache-status", "MISS")
		return resp
	}
}

export function sendErrorToTelegram<ENV extends { BA: KVNamespace }>(
	name: string,
): Handler<ENV> {
	return async (ctx, next) => {
		const { req, env, ec } = ctx
		const item = await env.BA.get<{
			token: string
			chatId: number
		}>("telegram:err", {
			type: "json",
			cacheTtl: 60 * 60, // 60min
		})
		const monitor = new TelegramMonitor(name, item?.token, item?.chatId)

		try {
			ctx.ec = {
				...ctx.ec,
				waitUntil: (promise: Promise<unknown>) => {
					const p = promise.catch((err) => monitor.error(err, req))
					ec.waitUntil(p)
				},
			}
			const resp = await next(ctx)
			return resp
		} catch (err) {
			if (err instanceof Response) {
				ec.waitUntil(monitor.logResponse(err, req))
				return err
			} else {
				ec.waitUntil(monitor.error(err, req))
				return HttpInternalServerError()
			}
		}
	}
}

export function serveHeadWithGet<ENV>(): Handler<ENV> {
	return async (ctx, next) => {
		const { req } = ctx
		if (req.method.toUpperCase() !== "HEAD") {
			return next(ctx)
		}

		const getReq = S.build(S.get(req.url), S.headers(req.headers))
		const getResp = await next({ ...ctx, req: getReq })
		const headResp = R.build(
			R.status(getResp.status),
			R.headers(getResp.headers),
		)
		return headResp
	}
}
