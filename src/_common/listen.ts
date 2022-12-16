import type { Params } from "./router.js"
import { WorkerRouter } from "./router.js"
import type { Monitor } from "./monitor.js"
import { Rollbar } from "./service/rollbar.js"
import {
	HttpInternalServerError,
	HttpNotFound,
	HttpOk,
} from "./http-response.js"

export function createSimpleWorker<Env>(
	handler: ExportedHandlerFetchHandler<Env>,
): ExportedHandler<Env> {
	return {
		async fetch(request: Request, env: Env, ctx: ExecutionContext) {
			try {
				return await handler(request, env, ctx)
			} catch (err) {
				if (err instanceof Response) {
					return err
				} else {
					console.log(err)
					return HttpInternalServerError()
				}
			}
		},
	}
}

export function createWorker<Env extends { ROLLBAR_KEY: string }>(
	name: string,
	handler: ExportedHandlerFetchHandler<Env>,
): ExportedHandler<Env> {
	return {
		async fetch(request: Request, env: Env, ctx: ExecutionContext) {
			const monitor = new Rollbar(env.ROLLBAR_KEY, name)
			try {
				return await handler(request, env, ctx)
			} catch (err) {
				if (err instanceof Response) {
					return err
				} else {
					ctx.waitUntil(monitor.error(err, request))
					return HttpInternalServerError()
				}
			}
		},
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
				// eslint-disable-next-line @typescript-eslint/no-throw-literal
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
