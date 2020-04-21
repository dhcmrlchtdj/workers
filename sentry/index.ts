import {} from '@cloudflare/workers-types'

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
                // TODO
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
