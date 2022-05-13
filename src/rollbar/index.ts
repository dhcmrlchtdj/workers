import { encodeHtmlEntities, Telegram } from "../_common/service/telegram"
import { createSimpleWorker } from "../_common/listen"

// https://docs.rollbar.com/docs/webhooks

type Env = {
    ROLLBAR_TG_BOT_TOKEN: string
    ROLLBAR_TG_CHAT_ID: string
}

const worker = createSimpleWorker(async (req: Request, env: Env) => {
    if (req.method.toUpperCase() !== "POST") {
        throw new Error("405 Method Not Allowed")
    }

    const payload: RollbarPayload = await req.json()
    const evt = payload.event_name
    if (evt === "occurrence") {
        const url = encodeHtmlEntities(payload.data.url)
        const error = encodeHtmlEntities(payload.data.occurrence.title)
        const text = `${url}\n<pre>${error}</pre>`
        const telegram = new Telegram(env.ROLLBAR_TG_BOT_TOKEN)
        await telegram.send("sendMessage", {
            parse_mode: "HTML",
            chat_id: Number(env.ROLLBAR_TG_CHAT_ID),
            text,
        })
    }

    return new Response("ok")
})

export default worker

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
