import type { Context, Params } from "./router"
import type { Monitor } from "./monitor"
import { Rollbar } from "./service/rollbar"

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
            event.waitUntil(monitor.error(err, event.request))
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
    route: (e: FetchEvent) => {
        handler: (ctx: Context) => Promise<Response>
        params: Params
    },
) {
    const monitor: Monitor = new Rollbar(rollbarKey, workerName)
    const h = async (event: FetchEvent) => {
        try {
            const router = route(event)
            const ctx = { event, monitor, params: router.params }
            const resp = await router.handler(ctx)
            return resp
        } catch (err) {
            event.waitUntil(monitor.error(err, event.request))
            return new Response("ok")
        }
    }
    addEventListener("fetch", (event) => event.respondWith(h(event)))
}
