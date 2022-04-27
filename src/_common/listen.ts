import type { WorkerRouter, Params } from "./router"
import type { Monitor } from "./monitor"
import { Rollbar } from "./service/rollbar"

export type Context = {
    event: FetchEvent
    params: Params
    monitor: Monitor
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
            event.waitUntil(monitor.error(err as Error))
        }
    }
    addEventListener("scheduled", (event) => event.waitUntil(h(event)))
}

export function listenFetch(
    workerName: string,
    rollbarKey: string,
    handler: (e: FetchEvent) => Promise<Response>,
) {
    const monitor: Monitor = new Rollbar(rollbarKey, workerName)
    const h = async (event: FetchEvent) => {
        try {
            const resp = await handler(event)
            return resp
        } catch (err) {
            event.waitUntil(monitor.error(err as Error, event.request))
            return new Response("ok")
        }
    }
    addEventListener("fetch", (event) => event.respondWith(h(event)))
}

export function listenFetchSimple(
    handler: (e: FetchEvent) => Promise<Response>,
) {
    const h = async (event: FetchEvent) => {
        try {
            const resp = await handler(event)
            return resp
        } catch (_) {
            return new Response("ok")
        }
    }
    addEventListener("fetch", (event) => event.respondWith(h(event)))
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
            event.waitUntil(monitor.error(err as Error, event.request))
            return new Response("ok")
        }
    }
    addEventListener("fetch", (event) => event.respondWith(h(event)))
}
