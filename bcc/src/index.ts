import {} from '@cloudflare/workers-types'
import { log } from './service/sentry'
import { webhook } from './webhook'
import { Router } from './router'

// from worker environment
declare const BCC_WEBHOOK_PATH: string
declare const BCC_BOT_TOKEN: string
declare const FAUNA_KEY: string
declare const SENTRY_KEY: string

const router = new Router().post(
    `/webhook/telegram/bcc/${BCC_WEBHOOK_PATH}`,
    event => webhook(event.request),
)

const handle = async (event: FetchEvent) => {
    try {
        const resp = await router.route(event)
        return resp
    } catch (err) {
        event.waitUntil(log('bcc', event.request, err))
        const msg = `${err}\n${err.stack}`
        return new Response(msg, { status: 200 })
    }
}

addEventListener('fetch', event => {
    event.respondWith(handle(event))
})
