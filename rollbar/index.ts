import {} from '@cloudflare/workers-types'
import { encodeHtmlEntities } from '../common/html'

// https://docs.rollbar.com/docs/webhooks
// https://rollbar.com/h11/feedbox/items/23/occurrences/117235378113/
// https://transform.tools/json-to-typescript
type Occurrence = {
    url: string
    occurrence: {
        feedurl: string
        body?: {
            message?: {
                body?: string
            }
            trace_chain?: Array<{
                exception?: {
                    message?: string
                }
            }>
        }
    }
}
type RollbarPayload = {
    event_name: 'occurrence'
    data: Occurrence
}

// from worker environment
declare const TELEGRAM_BOT_TOKEN: string
declare const TELEGRAM_CHAT_ID: string

// ---

addEventListener('fetch', event => {
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
    const feedurl = encodeHtmlEntities(data.occurrence.feedurl)
    const exception = encodeHtmlEntities(
        data.occurrence.body?.trace_chain?.[0]?.exception?.message ??
            data.occurrence.body?.message?.body ??
            '',
    )
    const text = [
        `feedurl = <a href="${feedurl}">${feedurl}</a>`,
        `exception = ${exception}`,
        `rollbar = <a href="${url}">${url}</a>`,
    ].join('\n')
    await sendToTelegram(text)
}

async function sendToTelegram(text: string) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            parse_mode: 'HTML',
            chat_id: Number(TELEGRAM_CHAT_ID),
            text,
        }),
    })
    return resp
}
