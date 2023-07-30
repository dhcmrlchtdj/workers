import { TelegramMonitor } from "./service/telegram-monitor.js"
import * as S from "../_common/http/request.js"
import * as R from "../_common/http/response.js"
import {
	HttpInternalServerError,
	HttpMethodNotAllowed,
	HttpNotFound,
	HttpUnsupportedMediaType,
} from "./http/status.js"
import { Tree } from "./router.js"

type RequestContext<ENV> = {
	req: Request
	env: ENV
	ec: ExecutionContext
}

type Middleware<ENV, Context extends RequestContext<ENV>> = (
	ctx: Context,
	next: Handler<Context>,
) => Response | Promise<Response>

type Handler<Context> = (ctx: Context) => Response | Promise<Response>

///

export function compose<
	ENV,
	Context extends RequestContext<ENV> = RequestContext<ENV>,
>(
	...fns: [Middleware<ENV, Context>, ...Middleware<ENV, Context>[]]
): Handler<Context> {
	return fns.reduceRight<Handler<Context>>(
		(next, fn) => (ctx) => fn(ctx, next),
		async () => HttpInternalServerError(),
	)
}

///

type RouterContext<ENV> = {
	req: Request
	env: ENV
	ec: ExecutionContext
	param: Map<string, string>
}
export class Router<ENV> {
	private _router: Tree<Handler<RouterContext<ENV>>>
	private _use: Middleware<ENV, RouterContext<ENV>>[]
	constructor() {
		this._router = new Tree()
		this._use = []
	}
	use(...fns: Middleware<ENV, RouterContext<ENV>>[]): this {
		this._use.push(...fns)
		return this
	}
	route(
		method: string | string[],
		pathname: string,
		...fns: [
			Middleware<ENV, RouterContext<ENV>>,
			...Middleware<ENV, RouterContext<ENV>>[],
		]
	): this {
		if (Array.isArray(method)) {
			method.forEach((m) => {
				this._route(m, pathname, fns)
			})
		} else {
			this._route(method, pathname, fns)
		}
		return this
	}
	private _route(
		method: string,
		pathname: string,
		fns: Middleware<ENV, RouterContext<ENV>>[],
	) {
		const segments = [method.toUpperCase(), ...pathname.split("/")]
		const withUse = [...this._use, ...fns] as [
			Middleware<ENV, RouterContext<ENV>>,
			...Middleware<ENV, RouterContext<ENV>>[],
		]
		const handler = compose(...withUse)
		this._router.set(segments, handler)
	}
	handle(rc: RequestContext<ENV>): Response | Promise<Response> {
		const req = rc.req
		const url = new URL(req.url)
		const segments = [req.method.toUpperCase(), ...url.pathname.split("/")]
		const found = this._router.get(segments)
		if (found) {
			const ctx = { ...rc, param: found.param }
			return found.matched(ctx)
		} else {
			return HttpNotFound()
		}
	}
}

///

export function checkMethod<ENV, Context extends RequestContext<ENV>>(
	...methods: string[]
): Middleware<ENV, Context> {
	methods = methods.map((x) => x.toUpperCase())
	return (ctx, next) => {
		if (!methods.includes(ctx.req.method.toUpperCase())) {
			throw HttpMethodNotAllowed(methods)
		}
		return next(ctx)
	}
}

export function checkContentType<ENV, Context extends RequestContext<ENV>>(
	expectedType: string,
): Middleware<ENV, Context> {
	return (ctx, next) => {
		const actualType = ctx.req.headers.get("content-type")
		if (!actualType?.startsWith(expectedType)) {
			throw HttpUnsupportedMediaType(`expect "${expectedType}"`)
		}
		return next(ctx)
	}
}

export function cacheResponse<
	ENV,
	Context extends RequestContext<ENV>,
>(): Middleware<ENV, Context> {
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

export function sendErrorToTelegram<
	ENV extends { BA: KVNamespace },
	Context extends RequestContext<ENV>,
>(name: string): Middleware<ENV, Context> {
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

export function serveHeadWithGet<
	ENV,
	Context extends RequestContext<ENV>,
>(): Middleware<ENV, Context> {
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
