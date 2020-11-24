import { Rollbar } from '../_common/service/rollbar'
import { WorkerRouter } from '../_common/router'
import { webhook } from './webhook'

// from worker environment
declare const BCC_WEBHOOK_PATH: string
declare const BCC_BOT_TOKEN: string
declare const ROLLBAR_KEY: string
declare const DB_API: string
declare const DB_TOKEN: string

const rollbar = new Rollbar(ROLLBAR_KEY, 'bcc')

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})

const router = new WorkerRouter().post(
    `/telegram/bcc/${BCC_WEBHOOK_PATH}`,
    (event) => webhook(event.request),
)

async function handle(event: FetchEvent) {
    try {
        await router.route(event)
    } catch (err) {
        event.waitUntil(rollbar.error(err, event.request))
    }
    return new Response('ok')
}
