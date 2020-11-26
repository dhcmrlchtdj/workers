import { Rollbar } from './service/rollbar'

export function initScheduleHandle(
    workerName: string,
    rollbarKey: string,
    handler: (e: ScheduledEvent) => Promise<unknown>,
) {
    const rollbar = new Rollbar(rollbarKey, workerName)
    const h = async (event: ScheduledEvent) => {
        try {
            await handler(event)
        } catch (err) {
            event.waitUntil(rollbar.error(err))
        }
    }
    addEventListener('scheduled', (event) => event.waitUntil(h(event)))
}

export function initFetchHandle(
    workerName: string,
    rollbarKey: string,
    handler: (e: FetchEvent) => Promise<unknown>,
) {
    const rollbar = new Rollbar(rollbarKey, workerName)
    const h = async (event: FetchEvent) => {
        try {
            await handler(event)
        } catch (err) {
            event.waitUntil(rollbar.error(err, event.request))
        }
        return new Response('ok')
    }
    addEventListener('fetch', (event) => event.respondWith(h(event)))
}

export function initFetchHandleSimple(
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
