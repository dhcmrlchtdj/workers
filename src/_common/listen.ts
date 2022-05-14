import type { WorkerRouter, Params } from "./router"
import type { Monitor } from "./monitor"
import { Rollbar } from "./service/rollbar"

export function createSimpleWorker<Env>(
    handler: ExportedHandlerFetchHandler<Env>,
): ExportedHandler<Env> {
    return {
        async fetch(request: Request, env: Env, ctx: ExecutionContext) {
            try {
                const resp = await handler(request, env, ctx)
                return resp
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
                const resp = await handler(request, env, ctx)
                return resp
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
    genRouter: (env: Env) => Promise<WorkerRouter<RouterContext<Env>>>,
): ExportedHandler<Env> {
    return {
        async fetch(request: Request, env: Env, ctx: ExecutionContext) {
            const monitor = new Rollbar(env.ROLLBAR_KEY, name)
            try {
                const router = await genRouter(env)
                const { handler, params } = router.route(request)
                const resp = await handler({
                    monitor,
                    params,
                    request,
                    env,
                    ctx,
                })
                return resp
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
