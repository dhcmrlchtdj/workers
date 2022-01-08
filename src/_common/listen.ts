import type { Context, Params } from "./router"
import type { Monitor } from "./monitor"
import { Rollbar } from "./service/rollbar"

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
            event.waitUntil(monitor.error(err as Error, event.request))
            return new Response("ok")
        }
    }
    addEventListener("fetch", (event) => event.respondWith(h(event)))
}
