import { encodeHtmlEntities, TelegramClient } from '../_common/telegram'

// https://docs.rollbar.com/docs/webhooks

// from worker environment
declare const TELEGRAM_BOT_TOKEN: string
declare const MY_TELEGRAM_CHAT_ID: string

const telegram = new TelegramClient(TELEGRAM_BOT_TOKEN)

// ---

addEventListener('fetch', (event) => {
    event.respondWith(handle(event.request))
})

async function handle(request: Request) {
    if (request.method.toUpperCase() === 'POST') {
        try {
            const payload = await request.json()
            await dispatch(payload)
        } catch (_) {}
    }
    return new Response(null, { status: 204 })
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
    const text = [
        `error = <pre>${error}</pre>`,
        `rollbar = ${url}`,
    ].join('\n')
    await telegram.send('sendMessage', {
        parse_mode: 'HTML',
        chat_id: Number(MY_TELEGRAM_CHAT_ID),
        text,
    })
}

// https://rollbar.com/h11/feedbox/items/23/occurrences/117235378113/
// https://transform.tools/json-to-typescript
type Occurrence = {
    url: string
    occurrence: {
        title: string
        // feedurl: string
        // body?: {
        //     message?: {
        //         body?: string
        //     }
        //     trace_chain?: Array<{
        //         exception?: {
        //             message?: string
        //         }
        //     }>
        // }
    }
}
type RollbarPayload = {
    event_name: 'occurrence'
    data: Occurrence
}
