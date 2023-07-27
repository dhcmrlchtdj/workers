import { TelegramMonitor } from "./service/telegram-monitor.js"
import * as S from "../_common/http/request.js"
import {
	HttpInternalServerError,
	HttpMethodNotAllowed,
	HttpUnsupportedMediaType,
} from "./http/status.js"

export type Context<ENV> = {
	req: Request
	env: ENV
	ctx: ExecutionContext
}

export type Middleware<ENV> = (
	ctx: Context<ENV>,
	next: () => Promise<Response>,
) => Promise<Response>

///

export function compose<ENV>(
	...fns: Middleware<ENV>[]
): (ctx: Context<ENV>) => Promise<Response> {
	return (ctx) => {
		const f = fns.reduceRight<() => Promise<Response>>(
			(next, fn) => () => fn(ctx, next),
			async () => HttpInternalServerError(),
		)
		return f()
	}
}

///

export function checkMethod<ENV>(...methods: string[]): Middleware<ENV> {
	methods = methods.map((x) => x.toUpperCase())
	return (ctx, next) => {
		if (!methods.includes(ctx.req.method.toUpperCase())) {
			throw HttpMethodNotAllowed(methods)
		}
		return next()
	}
}

export function checkContentType<ENV>(type: string): Middleware<ENV> {
	return (ctx, next) => {
		const ct = ctx.req.headers.get("content-type")
		if (!ct?.startsWith(type)) {
			throw HttpUnsupportedMediaType(ct ?? "")
		}
		return next()
	}
}

export function cacheResponse<ENV>(): Middleware<ENV> {
	return async ({ req, ctx }, next) => {
		if (req.method.toUpperCase() !== "GET") {
			return next()
		}

		// https://developers.cloudflare.com/workers/runtime-apis/cache/#match
		// Cloudflare Workers do not support the `ignoreSearch` or `ignoreVary` options on match()
		const url = new URL(req.url)
		url.search = "" // remove querystring

		const cacheKey = S.build(S.get(url), S.headers(req.headers))
		const cache = caches.default
		const cachedResp = await cache.match(cacheKey)
		if (cachedResp) return cachedResp

		const resp = await next()

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
	return async (ctx, next) => {
		const item = await ctx.env.BA.get<{
			token: string
			chatId: number
		}>("telegram:err", {
			type: "json",
			cacheTtl: 60 * 60, // 60min
		})
		const monitor = new TelegramMonitor(name, item?.token, item?.chatId)

		try {
			const resp = await next()
			return resp
		} catch (err) {
			if (err instanceof Response) {
				ctx.ctx.waitUntil(monitor.logResponse(err, ctx.req))
				return err
			} else {
				ctx.ctx.waitUntil(monitor.error(err, ctx.req))
				return HttpInternalServerError()
			}
		}
	}
}
