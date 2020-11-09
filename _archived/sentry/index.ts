import { TelegramClient } from '../../_common/telegram'
import { createHmac } from '../../_common/crypto'

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
            const fromSentry = await verifySignature(
                SENTRY_HOOK_SECRET,
                text,
                sig,
            )
            if (fromSentry) {
                const body = JSON.parse(text)
                await telegram.send('sendMessage', {
                    chat_id: Number(MY_TELEGRAM_CHAT_ID),
                    text: JSON.stringify(body, null, 4),
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
    const sig = await createHmac('SHA-256', secret)
        .update(message)
        .digest('hex')
    return sig === signature
}
