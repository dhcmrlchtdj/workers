import { type Params, WorkerRouter } from "./router.js"
import { type Monitor } from "./monitor.js"
import { Rollbar } from "./service/rollbar.js"
import {
	HttpInternalServerError,
	HttpMethodNotAllowed,
	HttpNotFound,
	HttpOk,
	HttpUnsupportedMediaType,
} from "./http-response.js"
import { TelegramMonitor } from "./service/telegram-monitor.js"

type VoidFetchHandler<Env = unknown> = (
	request: Request<unknown, IncomingRequestCfProperties>,
	env: Env,
	ctx: ExecutionContext,
) => void | Promise<void>

export function createSimpleWorker<Env>(
	...handlers: [...VoidFetchHandler<Env>[], ExportedHandlerFetchHandler<Env>]
): ExportedHandler<Env> {
	return {
		async fetch(
			request: Request<unknown, IncomingRequestCfProperties>,
			env: Env,
			ctx: ExecutionContext,
		) {
			try {
				let resp = null
				for (const handler of handlers) {
					resp = await handler(request, env, ctx)
				}
				return resp ?? HttpInternalServerError()
			} catch (err) {
				console.log(err)
				if (err instanceof Response) {
					return err
				} else {
					return HttpInternalServerError()
				}
			}
		},
	}
}

type ERR_TG = {
	ERR_TG_BOT_TOKEN: string
	ERR_TG_CHAT_ID: string
}
export function createWorker<Env extends ERR_TG>(
	name: string,
	...handlers: [...VoidFetchHandler<Env>[], ExportedHandlerFetchHandler<Env>]
): ExportedHandler<Env> {
	return {
		async fetch(
			request: Request<unknown, IncomingRequestCfProperties>,
			env: Env,
			ctx: ExecutionContext,
		) {
			const monitor = new TelegramMonitor(
				name,
				env.ERR_TG_BOT_TOKEN,
				env.ERR_TG_CHAT_ID,
			)
			try {
				let resp = null
				for (const handler of handlers) {
					resp = await handler(request, env, ctx)
				}
				return resp ?? HttpInternalServerError()
			} catch (err) {
				if (err instanceof Response) {
					ctx.waitUntil(monitor.logResponse(err, request))
					return err
				} else {
					ctx.waitUntil(monitor.error(err, request))
					return HttpInternalServerError()
				}
			}
		},
	}
}

export function allowMethod(...methods: string[]): VoidFetchHandler {
	methods = methods.map((x) => x.toUpperCase())
	return (req: Request) => {
		if (!methods.includes(req.method.toUpperCase())) {
			throw HttpMethodNotAllowed(methods)
		}
	}
}

export function contentType(type: string): VoidFetchHandler {
	return (req: Request) => {
		const ct = req.headers.get("content-type")
		if (!ct?.startsWith(type)) {
			throw HttpUnsupportedMediaType()
		}
	}
}

export type RouterContext<Env> = {
	monitor: Monitor
	params: Params
	req: Request
	env: Env
	ctx: ExecutionContext
}
export function createWorkerByRouter<Env extends { ROLLBAR_KEY: string }>(
	name: string,
	addRoute: (ctx: {
		router: WorkerRouter<RouterContext<Env>>
		req: Request
		env: Env
		ctx: ExecutionContext
		monitor: Monitor
	}) => void | Promise<void>,
	forceReturnOk = false,
): ExportedHandler<Env> {
	return {
		async fetch(req: Request, env: Env, ctx: ExecutionContext) {
			const monitor = new Rollbar(env.ROLLBAR_KEY, name)
			try {
				const router = new WorkerRouter<RouterContext<Env>>()
				await addRoute({ router, req, env, ctx, monitor })

				const found = router.route(req)
				if (!found) throw HttpNotFound()

				return await found.handler({
					monitor,
					params: found.params,
					req,
					env,
					ctx,
				})
			} catch (err) {
				let resp: Response

				if (err instanceof Response) {
					ctx.waitUntil(monitor.errorResponse(err, req))
					resp = err
				} else {
					ctx.waitUntil(monitor.error(err, req))
					resp = HttpInternalServerError()
				}

				if (forceReturnOk) {
					resp = HttpOk()
				}

				return resp
			}
		},
	}
}

export function createScheduler<Env extends { ROLLBAR_KEY: string }>(
	name: string,
	handler: ExportedHandlerScheduledHandler<Env>,
): ExportedHandler<Env> {
	return {
		async scheduled(
			controller: ScheduledController,
			env: Env,
			ctx: ExecutionContext,
		) {
			const monitor = new Rollbar(env.ROLLBAR_KEY, name)
			try {
				await handler(controller, env, ctx)
			} catch (err) {
				ctx.waitUntil(monitor.error(err))
			}
		},
	}
}
