import { HttpBadRequest, HttpOk } from "../_common/http-response.js"
import { allowMethod, createSimpleWorker } from "../_common/listen.js"
import { encodeHtmlEntities, Telegram } from "../_common/service/telegram.js"

// https://docs.rollbar.com/docs/webhooks

type Env = {
	ROLLBAR_TG_BOT_TOKEN: string
	ROLLBAR_TG_CHAT_ID: string
}

const worker = createSimpleWorker(
	allowMethod("POST"),
	async (req: Request, env: Env, ctx: ExecutionContext) => {
		const payload: RollbarPayload | undefined = await req.json()
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
				.then(() => undefined)
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
