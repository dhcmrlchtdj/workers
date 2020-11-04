import { Rollbar } from '../_common/rollbar'
import { WorkerRouter } from '../_common/router'
import { webhook } from './webhook'

// from worker environment
declare const BCC_WEBHOOK_PATH: string
declare const BCC_BOT_TOKEN: string
declare const ROLLBAR_KEY: string
declare const DB_API: string
declare const DB_TOKEN: string

const rollbar = new Rollbar(ROLLBAR_KEY, 'bcc')

const router = new WorkerRouter().post(
    `/telegram/bcc/${BCC_WEBHOOK_PATH}`,
    (event) => webhook(event.request),
)

const handle = async (event: FetchEvent) => {
    try {
        const resp = await router.route(event)
        return resp
    } catch (err) {
        event.waitUntil(rollbar.error(err, event.request))
        const msg = `${err}\n${err.stack}`
        return new Response(msg, { status: 200 })
    }
}

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})
