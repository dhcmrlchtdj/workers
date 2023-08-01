import type { Handler } from "./type.js"
import * as R from "../http/response.js"
import * as S from "../http/request.js"
import {
	HttpInternalServerError,
	HttpUnsupportedMediaType,
} from "../http/status.js"
import { TelegramMonitor } from "../service/telegram-monitor.js"

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
