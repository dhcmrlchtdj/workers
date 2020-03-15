import {} from '@cloudflare/workers-types'

// from https://docs.rollbar.com/docs/webhooks
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
    event.respondWith(handle(event))
})

async function handle(event: FetchEvent) {
    const req = event.request
    if (req.method.toUpperCase() === 'POST') {
        try {
            const payload = await req.json()
            event.waitUntil(dispatch(payload))
        } catch (_) {}
    }
    const response = new Response(null, {
        status: 204,
        statusText: 'No Content',
    })
    return response
}

async function dispatch(payload: RollbarPayload) {
    const evt = payload.event_name
    if (evt === 'occurrence') {
        await handleOccurrence(payload.data)
    }
}

async function handleOccurrence(data: Occurrence) {
    const url = data.url
    const feedurl = data.occurrence.feedurl
    const exception =
        data.occurrence.body?.trace_chain?.[0]?.exception?.message ??
        data.occurrence.body?.message?.body
    const text = [
        `rollbar = <a href="${url}">${url}</a>`,
        `feedurl = <a href="${feedurl}">${feedurl}</a>`,
        `exception = ${exception}`,
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
