import {} from '@cloudflare/workers-types'
import { log } from '../_common/sentry'
import { sendMessage } from '../_common/telegram'
import { WorkerRouter } from '../_common/router'
import * as db from './db'

declare const FAUNA_KEY: string
declare const SENTRY_KEY: string
declare const TELEGRAM_BOT_TOKEN: string
declare const TELEGRAM_CHAT_ID: string

const sendToIM = async (ip: string) => {
    const text = [`BadIP Found: <code>${ip}</code>`]

    const ipReq = await fetch(`https://freegeoip.app/json/${ip}`)
    if (ipReq.ok) {
        const ipData = await ipReq.json()
        const { country_name, region_name, city } = ipData
        text.push(`${country_name}, ${region_name}, ${city}`)
    }

    text.push(`https://www.cip.cc/${ip}`)

    await sendMessage(TELEGRAM_BOT_TOKEN, {
        parse_mode: 'HTML',
        chat_id: Number(TELEGRAM_CHAT_ID),
        text: text.join('\n'),
        disable_web_page_preview: true,
    })
}

const router = new WorkerRouter()
    .post('/badip/report', async (event) => {
        const req = event.request
        const payload = await req.json()
        const ip = payload.ip
        if (ip) {
            await db.report(ip)
            event.waitUntil(sendToIM(ip))
            return new Response('created', { status: 201 })
        } else {
            return new Response('invalid payload', { status: 200 })
        }
    })
    .get('/badip/all', async (_event) => {
        const list = await db.getAll()
        return new Response(JSON.stringify(list, null, 4), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
        })
    })
    .get('/badip/recent', async (event) => {
        const query = new URL(event.request.url).searchParams
        const days = Number(query.get('days') ?? 14)
        const list = await db.getRecent(days)
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
