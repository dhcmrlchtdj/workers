import {
    HttpBadRequest,
    HttpMethodNotAllowed,
    HttpOk,
} from "../_common/http-response"
import { createSimpleWorker } from "../_common/listen"
import { encodeHtmlEntities, Telegram } from "../_common/service/telegram"

// https://docs.rollbar.com/docs/webhooks

type Env = {
    ROLLBAR_TG_BOT_TOKEN: string
    ROLLBAR_TG_CHAT_ID: string
}

const worker = createSimpleWorker(
    async (req: Request, env: Env, ctx: ExecutionContext) => {
        if (req.method.toUpperCase() !== "POST") {
            return HttpMethodNotAllowed(["POST"])
        }

        const payload: RollbarPayload = await req.json()
        if (payload?.event_name !== "occurrence") {
            const msg = `unknown event: "${payload?.event_name}"`
            console.log(msg)
            return HttpBadRequest(msg)
        }

        const url = encodeHtmlEntities(payload.data.url)
        const error = encodeHtmlEntities(payload.data.occurrence.title)
        const text = `${url}\n<pre>${error}</pre>`
        const telegram = new Telegram(env.ROLLBAR_TG_BOT_TOKEN)
        ctx.waitUntil(
            telegram
                .send("sendMessage", {
                    parse_mode: "HTML",
                    chat_id: Number(env.ROLLBAR_TG_CHAT_ID),
                    text,
                })
                .catch((err) => {
                    console.log(`sendMessage failed | "${err}"`)
                }),
        )
        return HttpOk()
    },
)

export default worker

///

type RollbarPayload = {
    event_name: string
    data: {
        url: string
        occurrence: {
            title: string
        }
    }
}
