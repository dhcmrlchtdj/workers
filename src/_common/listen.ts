import type { Params } from "./router"
import { WorkerRouter } from "./router"
import type { Monitor } from "./monitor"
import { Rollbar } from "./service/rollbar"

export function createSimpleWorker<Env>(
    handler: ExportedHandlerFetchHandler<Env>,
): ExportedHandler<Env> {
    return {
        async fetch(request: Request, env: Env, ctx: ExecutionContext) {
            try {
                return await handler(request, env, ctx)
            } catch (err) {
                console.log(err)
                return new Response("ok")
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
                ctx.waitUntil(monitor.error(err, request))
                return new Response("ok")
            }
        },
    }
}

export type RouterContext<Env> = {
    monitor: Monitor
    params: Params
    request: Request
    env: Env
    ctx: ExecutionContext
}
export function createWorkerByRouter<Env extends { ROLLBAR_KEY: string }>(
    name: string,
    addRoute: (
        router: WorkerRouter<RouterContext<Env>>,
        request: Request,
        env: Env,
        ctx: ExecutionContext,
    ) => Promise<void>,
): ExportedHandler<Env> {
    return {
        async fetch(request: Request, env: Env, ctx: ExecutionContext) {
            const monitor = new Rollbar(env.ROLLBAR_KEY, name)
            try {
                const router = new WorkerRouter<RouterContext<Env>>()
                await addRoute(router, request, env, ctx)
                const { handler, params } = router.route(request)
                if (handler) {
                    return await handler({
                        monitor,
                        params,
                        request,
                        env,
                        ctx,
                    })
                } else {
                    ctx.waitUntil(
                        monitor.warn(new Error("handler not found"), request),
                    )
                    return new Response("ok")
                }
            } catch (err) {
                ctx.waitUntil(monitor.error(err, request))
                return new Response("ok")
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
