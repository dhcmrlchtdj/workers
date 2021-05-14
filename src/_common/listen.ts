import { Rollbar } from './service/rollbar'
import type { Monitor } from './monitor'

export function listenSchedule(
    workerName: string,
    rollbarKey: string,
    handler: (e: ScheduledEvent) => Promise<unknown>,
) {
    const monitor: Monitor = new Rollbar(rollbarKey, workerName)
    const h = async (event: ScheduledEvent) => {
        try {
            await handler(event)
        } catch (err) {
            event.waitUntil(monitor.error(err))
        }
    }
    addEventListener('scheduled', (event) => event.waitUntil(h(event)))
}

export function listenFetch(
    workerName: string,
    rollbarKey: string,
    handler: (e: FetchEvent) => Promise<unknown>,
) {
    const monitor: Monitor = new Rollbar(rollbarKey, workerName)
    const h = async (event: FetchEvent) => {
        try {
            await handler(event)
        } catch (err) {
            event.waitUntil(monitor.error(err, event.request))
        }
        return new Response('ok')
    }
    addEventListener('fetch', (event) => event.respondWith(h(event)))
}

export function listenFetchSimple(
    handler: (e: FetchEvent) => Promise<unknown>,
) {
    const h = async (event: FetchEvent) => {
        try {
            await handler(event)
        } catch (_) {}
        return new Response('ok')
    }
    addEventListener('fetch', (event) => event.respondWith(h(event)))
}
