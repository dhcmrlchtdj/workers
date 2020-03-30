import {} from '@cloudflare/workers-types'
import { log } from '../_common/sentry'
import { sendMessage } from '../_common/telegram'
import { WorkerRouter } from '../_common/router'
import * as db from './db'

declare const FAUNA_KEY: string
declare const SENTRY_KEY: string
declare const TELEGRAM_BOT_TOKEN: string
declare const TELEGRAM_CHAT_ID: string

const router = new WorkerRouter()
    .post('/badip/report', async (event) => {
        const req = event.request
        const { ip } = await req.json()

        await db.report(ip)

        const tg = sendMessage(TELEGRAM_BOT_TOKEN, {
            parse_mode: 'MarkdownV2',
            chat_id: Number(TELEGRAM_CHAT_ID),
            text: `BadIP Found: \`${ip}\`\nhttps://www.cip.cc/${ip}`,
        })
        event.waitUntil(tg)

        return new Response('created', { status: 201 })
    })
    .get('/badip/all', async (_event) => {
        const list = await db.getAll()
        return new Response(JSON.stringify(list, null, 4), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
        })
    })
    .get('/badip/recent', async (_event) => {
        const list = await db.getRecent(60)
        return new Response(JSON.stringify(list, null, 4), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
        })
    })

const handle = async (event: FetchEvent) => {
    try {
        const resp = await router.route(event)
        return resp
    } catch (err) {
        event.waitUntil(log(SENTRY_KEY, 'badip', event.request, err))
        const msg = `${err}\n${err.stack}`
        return new Response(msg, { status: 200 })
    }
}

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})
