import {} from '@cloudflare/workers-types'
import { sendMessage, encodeHtmlEntities } from '../_common/telegram'

// https://rollbar.com/h11/feedbox/items/23/occurrences/117235378113/
// https://transform.tools/json-to-typescript

// from worker environment
declare const TELEGRAM_BOT_TOKEN: string
declare const TELEGRAM_CHAT_ID: string

// ---

addEventListener('fetch', (event) => {
    event.respondWith(handle(event.request))
})

async function handle(request: Request) {
    if (request.method.toUpperCase() === 'POST') {
        try {
            const payload = await request.json()
            const body = JSON.stringify(payload)
            const signature = request.headers.get('Sentry-Hook-Signature')
            const fromSentry = await verifySignature(body, signature)
            if (fromSentry) {
                await dispatch(payload)
            }
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
        `feedurl = ${feedurl}`,
        `exception = ${exception}`,
        `rollbar = ${url}`,
    ].join('\n')
    await sendMessage(TELEGRAM_BOT_TOKEN, {
        parse_mode: 'HTML',
        chat_id: Number(TELEGRAM_CHAT_ID),
        text,
    })
}

async function verifySignature(
    message: string,
    signature: string | null,
): Promise<boolean> {
    if (signature === null) return false
    const encoder = new TextEncoder()
    const data = encoder.encode(message)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    return hashHex === signature
}
