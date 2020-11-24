import { encodeHtmlEntities, Telegram } from '../_common/service/telegram'

// https://docs.rollbar.com/docs/webhooks

// from worker environment
declare const ROLLBAR_TG_BOT_TOKEN: string
declare const ROLLBAR_TG_CHAT_ID: string

const telegram = new Telegram(ROLLBAR_TG_BOT_TOKEN)

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})

async function handle(event: FetchEvent) {
    const request = event.request
    if (request.method.toUpperCase() === 'POST') {
        try {
            const payload = await request.json()
            await dispatch(payload)
        } catch (_) {}
    }
    return new Response('ok')
}

async function dispatch(payload: RollbarPayload) {
    const evt = payload.event_name
    if (evt === 'occurrence') {
        await handleOccurrence(payload.data)
    }
}

async function handleOccurrence(data: Occurrence) {
    const url = encodeHtmlEntities(data.url)
    const error = encodeHtmlEntities(data.occurrence.title)
    const text = `${url}\n<pre>${error}</pre>`
    await telegram.send('sendMessage', {
        parse_mode: 'HTML',
        chat_id: Number(ROLLBAR_TG_CHAT_ID),
        text,
    })
}

type Occurrence = {
    url: string
    occurrence: {
        title: string
    }
}

type RollbarPayload = {
    event_name: 'occurrence'
    data: Occurrence
}
