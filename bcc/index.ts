import {} from '@cloudflare/workers-types'
import { Sentry } from '../_common/sentry'
import { WorkerRouter } from '../_common/router'
import { webhook } from './webhook'

// from worker environment
declare const BCC_WEBHOOK_PATH: string
declare const BCC_BOT_TOKEN: string
declare const FAUNA_KEY: string
declare const SENTRY_KEY: string

const sentry = new Sentry(5024029, SENTRY_KEY, 'bcc')

const router = new WorkerRouter().post(
    `/telegram/bcc/${BCC_WEBHOOK_PATH}`,
    (event) => webhook(event.request),
)

const handle = async (event: FetchEvent) => {
    try {
        const resp = await router.route(event)
        return resp
    } catch (err) {
        event.waitUntil(sentry.log(event.request, err))
        const msg = `${err}\n${err.stack}`
        return new Response(msg, { status: 200 })
    }
}

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})
