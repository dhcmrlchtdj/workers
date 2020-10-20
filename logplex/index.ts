import { Rollbar } from '../_common/rollbar'
import { WorkerRouter } from '../_common/router'
// import { TelegramClient } from '../_common/telegram'

// from worker environment
declare const FBOX_LOGPLEX_WEBHOOK_PATH: string // openssl rand -hex 16
declare const FBOX_LOGPLEX_DRAIN_TOKEN: string
declare const ROLLBAR_KEY: string

// declare const TELEGRAM_BOT_TOKEN: string
// declare const MY_TELEGRAM_CHAT_ID: string
// const telegram = new TelegramClient(TELEGRAM_BOT_TOKEN)

const rollbar = new Rollbar(ROLLBAR_KEY, 'logplex')

const router = new WorkerRouter()
router.post(`/logplex/${FBOX_LOGPLEX_WEBHOOK_PATH}`, async (event) => {
    const req = event.request
    if (req.headers.get('content-type') !== 'application/logplex-1') {
        throw new Error('415 Unsupported Media Type')
    }
    if (req.headers.get('logplex-drain-token') !== FBOX_LOGPLEX_DRAIN_TOKEN) {
        throw new Error('403 Forbidden')
    }

    // const text = await req.text()
    // await telegram.send('sendMessage', {
    //     chat_id: Number(MY_TELEGRAM_CHAT_ID),
    //     text,
    // })

    return new Response('ok', { status: 200 })
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
