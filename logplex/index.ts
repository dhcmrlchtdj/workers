import { Rollbar } from '../_common/rollbar'
import { WorkerRouter } from '../_common/router'
import { TelegramClient } from '../_common/telegram'

// from worker environment
declare const FBOX_LOGPLEX_WEBHOOK_PATH: string // openssl rand -hex 16
declare const ROLLBAR_KEY: string

declare const TELEGRAM_BOT_TOKEN: string
declare const MY_TELEGRAM_CHAT_ID: string
const telegram = new TelegramClient(TELEGRAM_BOT_TOKEN)

const rollbar = new Rollbar(ROLLBAR_KEY, 'bcc')

const router = new WorkerRouter()
router.post(`/logplex/${FBOX_LOGPLEX_WEBHOOK_PATH}`, async (event) => {
    const req = event.request
    const obj = { headers: {} as any, body: null as any }
    req.headers.forEach((v, k) => {
        obj.headers[k] = v
    })
    obj.body = (await req.text()).split('\n')
    const text = JSON.stringify(obj)

    await telegram.send('sendMessage', {
        parse_mode: 'HTML',
        chat_id: Number(MY_TELEGRAM_CHAT_ID),
        text,
    })
    return new Response('', { status: 200 })
})

const handle = async (event: FetchEvent) => {
    try {
        const resp = await router.route(event)
        return resp
    } catch (err) {
        event.waitUntil(rollbar.err(event.request, err))
        const msg = `${err}\n${err.stack}`
        return new Response(msg, { status: 200 })
    }
}

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})
