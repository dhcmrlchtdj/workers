// const TELEGRAM_BOT_TOKEN = ''
// const TELEGRAM_CHAT_ID = ''

addEventListener('fetch', event => {
    event.respondWith(handle(event))
})

async function handle(event) {
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

async function dispatch(payload) {
    const evt = payload.event_name
    if (evt === 'occurrence') {
        await handleOccurrence(payload.data)
    }
}

async function handleOccurrence(data) {
    const exception = (() => {
        try {
            return data.occurrence.body.trace_chain[0].exception.message
        } catch (err) {
            return err.message
        }
    })()
    const text = `<pre>rollbar   = ${data.url}
feedurl   = ${data.occurrence.feedurl}
exception = ${exception}
</pre>`
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
            parse_mode: 'HTML',
            chat_id: Number(TELEGRAM_CHAT_ID),
            text,
        }),
    })
    return resp
}
