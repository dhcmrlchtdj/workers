import { encodeHtmlEntities, Telegram } from "../_common/service/telegram"

// https://docs.rollbar.com/docs/webhooks

// from worker environment
type ENV = {
    ROLLBAR_TG_BOT_TOKEN: string
    ROLLBAR_TG_CHAT_ID: string
}

///

const worker: ExportedHandler<ENV> = {
    async fetch(req, env, _ctx) {
        try {
            return await handler(req, env)
        } catch (_) {
            return new Response("ok")
        }
    },
}

export default worker

///

async function handler(req: Request, env: ENV) {
    if (req.method.toUpperCase() !== "POST")
        throw new Error("405 Method Not Allowed")

    const payload: RollbarPayload = await req.json()
    const evt = payload.event_name
    if (evt === "occurrence") {
        await handleOccurrence(env, payload.data)
    }

    return new Response("ok")
}

async function handleOccurrence(env: ENV, data: Occurrence) {
    const telegram = new Telegram(env.ROLLBAR_TG_BOT_TOKEN)

    const url = encodeHtmlEntities(data.url)
    const error = encodeHtmlEntities(data.occurrence.title)
    const text = `${url}\n<pre>${error}</pre>`
    await telegram.send("sendMessage", {
        parse_mode: "HTML",
        chat_id: Number(env.ROLLBAR_TG_CHAT_ID),
        text,
    })
}

///

type RollbarPayload = {
    event_name: "occurrence"
    data: Occurrence
}

type Occurrence = {
    url: string
    occurrence: {
        title: string
    }
}
