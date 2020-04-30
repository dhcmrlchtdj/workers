import type {} from '@cloudflare/workers-types'
import { TelegramClient } from '../_common/telegram'

// from worker environment
declare const TELEGRAM_BOT_TOKEN: string
declare const MY_TELEGRAM_CHAT_ID: string

const telegram = new TelegramClient(TELEGRAM_BOT_TOKEN)

addEventListener('fetch', (event) => {
    event.respondWith(handle(event.request))
})

async function handle(request: Request) {
    if (request.method.toUpperCase() === 'POST') {
        try {
            const payload = await request.text()
            const signature = request.headers.get('Sentry-Hook-Signature')
            const fromSentry = await verifySignature(payload, signature)
            if (fromSentry) {
                const body = JSON.parse(payload)
                await telegram.send('sendMessage', {
                    chat_id: Number(MY_TELEGRAM_CHAT_ID),
                    text: body,
                })
            }
        } catch (_) {}
    }
    return new Response(null, { status: 204 })
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
