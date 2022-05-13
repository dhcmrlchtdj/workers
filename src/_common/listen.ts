import type { WorkerRouter, Params } from "./router"
import type { Monitor } from "./monitor"
import { Rollbar } from "./service/rollbar"

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
            } finally {
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

export function listenSchedule(
    workerName: string,
    rollbarKey: string,
    handler: (ctx: {
        event: ScheduledEvent
        monitor: Monitor
    }) => Promise<unknown>,
) {
    const monitor: Monitor = new Rollbar(rollbarKey, workerName)
    const h = async (event: ScheduledEvent) => {
        try {
            await handler({ event, monitor })
        } catch (err) {
            event.waitUntil(monitor.error(err))
        }
    }
    addEventListener("scheduled", (event) => event.waitUntil(h(event)))
}

export type Context = {
    event: FetchEvent
    params: Params
    monitor: Monitor
}

export function routeFetch(
    workerName: string,
    rollbarKey: string,
    router: WorkerRouter<Context>,
) {
    const monitor: Monitor = new Rollbar(rollbarKey, workerName)
    const h = async (event: FetchEvent) => {
        try {
            const r = router.route(event)
            const ctx: Context = { event, monitor, params: r.params }
            const resp = await r.handler(ctx)
            return resp
        } catch (err) {
            event.waitUntil(monitor.error(err, event.request))
            return new Response("ok")
        }
    }
    addEventListener("fetch", (event) => event.respondWith(h(event)))
}
