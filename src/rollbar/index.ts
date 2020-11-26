import { initFetchHandleSimple } from '../_common/init_handle'
import { encodeHtmlEntities, Telegram } from '../_common/service/telegram'

// https://docs.rollbar.com/docs/webhooks

// from worker environment
declare const ROLLBAR_TG_BOT_TOKEN: string
declare const ROLLBAR_TG_CHAT_ID: string

///

initFetchHandleSimple(notify)

///

const telegram = new Telegram(ROLLBAR_TG_BOT_TOKEN)

async function notify(event: FetchEvent) {
    const req = event.request
    if (req.method.toUpperCase() !== 'POST')
        throw new Error('405 Method Not Allowed')

    const payload: RollbarPayload = await req.json()
    const evt = payload.event_name
    if (evt === 'occurrence') {
        await handleOccurrence(payload.data)
    }
}

async function handleOccurrence(data: Occurrence) {
    const url = encodeHtmlEntities(data.url)
    const error = encodeHtmlEntities(data.occurrence.title)
    const text = `${url}\n<pre>${error}</pre>`
    await telegram.send('sendMessage', {
        parse_mode: 'HTML',
        chat_id: Number(ROLLBAR_TG_CHAT_ID),
        text,
    })
}

///

type RollbarPayload = {
    event_name: 'occurrence'
    data: Occurrence
}

type Occurrence = {
    url: string
    occurrence: {
        title: string
    }
}
