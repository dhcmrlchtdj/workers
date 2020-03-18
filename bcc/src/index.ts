import {} from '@cloudflare/workers-types'
import { log } from './service/sentry'
import { webhook } from './webhook'

// from worker environment
declare const BCC_WEBHOOK_PATH: string
declare const BCC_BOT_TOKEN: string
declare const FAUNA_KEY: string
declare const SENTRY_KEY: string

addEventListener('fetch', event => {
    event.respondWith(handle(event))
})

async function handle(event: FetchEvent) {
    try {
        return await route(event.request)
    } catch (err) {
        event.waitUntil(log('bcc', event.request, err))
        const msg = `${err}\n${err.stack}`
        return new Response(msg, { status: 200 })
    }
}

async function route(request: Request) {
    const url = new URL(request.url)
    switch (url.pathname) {
        case `/webhook/telegram/bcc/${BCC_WEBHOOK_PATH}`:
            if (request.method.toUpperCase() === 'POST') {
                return webhook(request)
            } else {
                return new Response('405', { status: 200 })
            }
        default:
            return new Response('404', { status: 200 })
    }
}
