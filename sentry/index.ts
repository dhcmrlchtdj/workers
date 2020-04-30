import type {} from '@cloudflare/workers-types'
import { TelegramClient } from '../_common/telegram'

// from worker environment
declare const SENTRY_HOOK_SECRET: string
declare const TELEGRAM_BOT_TOKEN: string
declare const MY_TELEGRAM_CHAT_ID: string

const telegram = new TelegramClient(TELEGRAM_BOT_TOKEN)

addEventListener('fetch', (event) => {
    event.respondWith(handle(event.request))
})

async function handle(request: Request) {
    if (request.method.toUpperCase() === 'POST') {
        try {
            const text = await request.text()
            const sig = request.headers.get('Sentry-Hook-Signature')
            const fromSentry = await verifySignature(SENTRY_HOOK_SECRET, text, sig)
            if (fromSentry) {
                const body = JSON.parse(text)
                await telegram.send('sendMessage', {
                    chat_id: Number(MY_TELEGRAM_CHAT_ID),
                    text: JSON.stringify(body, null, 4),
                })
            } else {
                await telegram.send('sendMessage', {
                    chat_id: Number(MY_TELEGRAM_CHAT_ID),
                    text,
                })
            }
        } catch (_) {}
    }
    return new Response(null, { status: 204 })
}

// https://docs.sentry.io/workflow/integrations/integration-platform/webhooks/?platform=node#verifying-the-signature
async function verifySignature(
    secret: string,
    message: string,
    signature: string | null,
): Promise<boolean> {
    if (signature === null) return false
    const s = crypto.subtle
    const enc = new TextEncoder()
    const key = await s.importKey(
        'raw',
        enc.encode(secret),
        {
            name: 'HMAC',
            hash: 'SHA-256',
        },
        false,
        ['verify'],
        // ['sign', 'verify'],
    )
    const sig = new Uint8Array(
        signature.match(/[0-9a-fA-F]{2}/g)!.map((x) => parseInt(x, 16)),
    )
    return s.verify('HMAC', key, sig, enc.encode(message))

    // const sig = await s.sign('HMAC', key, enc.encode(message))
    // const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
