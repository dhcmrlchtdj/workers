import {} from '@cloudflare/workers-types'
import { WorkerRouter } from '../_common/router'
import { Sentry } from '../_common/sentry'
// import { FaunaClient } from '../_common/fauna'
import { webhook } from './webhook'

// declare const FAUNA_KEY: string
declare const SENTRY_KEY: string
declare const MY_TELEGRAM_CHAT_ID: string
declare const MZBOT_WEBHOOK_PATH: string
declare const MZBOT_BOT_TOKEN: string

// const fauna = new FaunaClient(FAUNA_KEY)
const sentry = new Sentry(5024029, SENTRY_KEY, 'mzbot')

const router = new WorkerRouter().post(
    `/telegram/mzbot/${MZBOT_WEBHOOK_PATH}`,
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
