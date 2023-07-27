import { TelegramMonitor } from "./service/telegram-monitor.js"
import * as S from "../_common/http/request.js"
import {
	HttpInternalServerError,
	HttpMethodNotAllowed,
	HttpUnsupportedMediaType,
} from "./http/status.js"

export type RequestContext<ENV> = {
	req: Request
	env: ENV
	ctx: ExecutionContext
}

export type Middleware<ENV> = (
	rc: RequestContext<ENV>,
	next: NextFn<ENV>,
) => Promise<Response>

type NextFn<ENV> = (rc: RequestContext<ENV>) => Promise<Response>

///

export function compose<ENV>(...fns: Middleware<ENV>[]): NextFn<ENV> {
	const f = fns.reduceRight<NextFn<ENV>>(
		(next, fn) => (rc) => fn(rc, next),
		async () => HttpInternalServerError(),
	)
	return f
}

///

export function checkMethod<ENV>(...methods: string[]): Middleware<ENV> {
	methods = methods.map((x) => x.toUpperCase())
	return (rc, next) => {
		if (!methods.includes(rc.req.method.toUpperCase())) {
			throw HttpMethodNotAllowed(methods)
		}
		return next(rc)
	}
}

export function checkContentType<ENV>(type: string): Middleware<ENV> {
	return (rc, next) => {
		const ct = rc.req.headers.get("content-type")
		if (!ct?.startsWith(type)) {
			throw HttpUnsupportedMediaType(ct ?? "")
		}
		return next(rc)
	}
}

export function cacheResponse<ENV>(): Middleware<ENV> {
	return async (rc, next) => {
		const { req, ctx } = rc
		if (req.method.toUpperCase() !== "GET") {
			return next(rc)
		}

		// https://developers.cloudflare.com/workers/runtime-apis/cache/#match
		// Cloudflare Workers do not support the `ignoreSearch` or `ignoreVary` options on match()
		const url = new URL(req.url)
		url.search = "" // remove querystring

		const cacheKey = S.build(S.get(url), S.headers(req.headers))
		const cache = caches.default
		const cachedResp = await cache.match(cacheKey)
		if (cachedResp) return cachedResp

		const resp = await next(rc)

		// https://developers.cloudflare.com/workers/runtime-apis/cache/#invalid-parameters
		if (resp.status === 200) {
			ctx.waitUntil(cache.put(cacheKey, resp.clone()))
		}

		resp.headers.set("X-Worker-Cache-Status", "MISS")
		return resp
	}
}

export function sendErrorToTelegram<ENV extends { BA: KVNamespace }>(
	name: string,
): Middleware<ENV> {
	return async (rc, next) => {
		const { req, env, ctx } = rc
		const item = await env.BA.get<{
			token: string
			chatId: number
		}>("telegram:err", {
			type: "json",
			cacheTtl: 60 * 60, // 60min
		})
		const monitor = new TelegramMonitor(name, item?.token, item?.chatId)

		try {
			rc.ctx = {
				...rc.ctx,
				waitUntil: (promise: Promise<unknown>) => {
					const p = promise.catch((err) => monitor.error(err, req))
					ctx.waitUntil(p)
				},
			}
			const resp = await next(rc)
			return resp
		} catch (err) {
			if (err instanceof Response) {
				ctx.waitUntil(monitor.logResponse(err, req))
				return err
			} else {
				ctx.waitUntil(monitor.error(err, req))
				return HttpInternalServerError()
			}
		}
	}
}
