import { getBA } from "../http/basic_auth.ts"
import * as S from "../http/request.ts"
import * as R from "../http/response.ts"
import {
	HttpInternalServerError,
	HttpUnauthorized,
	HttpUnsupportedMediaType,
} from "../http/status.ts"
import { TelegramMonitor } from "../service/telegram-monitor.ts"
import { addServerTiming, getInContext } from "./context.ts"
import type { Handler, RouterContext } from "./type.ts"

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
			r.headers.set("ww-cache-status", "HIT")
			ec.waitUntil(cache.put(cacheKey, r))
		}

		resp.headers.set("ww-cache-status", "MISS")
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

		ctx.ec = {
			...ctx.ec,
			waitUntil: (promise: Promise<unknown>) => {
				const p = promise.catch((err) => monitor.error(err, req))
				ec.waitUntil(p)
			},
		}
		try {
			return await next(ctx)
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
		const headResp = R.build(R.clone(getResp), R.body(null))
		return headResp
	}
}

export function basicAuth<ENV>(
	verify: (
		username: string,
		password: string,
		ctx: RouterContext<ENV>,
	) => Promise<boolean> | boolean,
): Handler<ENV> {
	return async (ctx, next) => {
		const header = ctx.req.headers.get("authorization")
		const { username, password } = getBA(header)
		const passed = await verify(username, password, ctx)
		if (!passed) throw HttpUnauthorized(["Basic"], "invalid")
		return next(ctx)
	}
}

export function serverTiming<ENV>(): Handler<ENV> {
	return async (ctx, next) => {
		const end = addServerTiming("total")
		const resp = await next(ctx)
		end()

		const r = R.build(
			R.clone(resp),
			R.header("server-timing", getInContext<string>("__ServerTiming__")),
		)
		return r
	}
}
