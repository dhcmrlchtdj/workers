// const TELEGRAM_BOT_TOKEN = ''
// const TELEGRAM_CHAT_ID = ''

addEventListener('fetch', event => {
    event.respondWith(handle(event.request))
})

async function handle(request) {
    if (request.method.toUpperCase() !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    } else {
        const payload = request.json()
        dispatchRollbar(payload)
        return new Response('', { status: 204 })
    }
}

async function dispatchRollbar(payload) {
    const evt = payload.event_name
    if (evt === 'occurrence') {
        await handleOccurrence(payload.data)
    }
}

async function handleOccurrence(data) {
    const msg = {
        rollbar: data.url,
        feedurl: data.occurrence.feedurl,
        exception: (() => {
            try {
                return data.occurrence.body.trace_chain[0].exception.message
            } catch (err) {
                return err.message
            }
        })(),
    }
    const text = JSON.stringify(msg, null, 4)
    await sendToTelegram(text)
}

async function sendToTelegram(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: Number(TELEGRAM_CHAT_ID),
            text,
        }),
    })
    return resp
}
