import { TelegramMonitor } from "./service/telegram-monitor.js"
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
