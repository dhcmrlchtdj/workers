import {} from '@cloudflare/workers-types'
import { log } from '../util/sentry'
import { WorkerRouter } from '../util/router'
import { webhook } from './webhook'

// from worker environment
declare const BCC_WEBHOOK_PATH: string
declare const BCC_BOT_TOKEN: string
declare const FAUNA_KEY: string
declare const SENTRY_KEY: string

const router = new WorkerRouter().post(
    `/webhook/telegram/bcc/${BCC_WEBHOOK_PATH}`,
    (event) => webhook(event.request),
)

const handle = async (event: FetchEvent) => {
    try {
        const resp = await router.route(event)
        return resp
    } catch (err) {
        event.waitUntil(log(SENTRY_KEY, 'bcc', event.request, err))
        const msg = `${err}\n${err.stack}`
        return new Response(msg, { status: 200 })
    }
}

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})
