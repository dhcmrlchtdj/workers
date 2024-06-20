import {
	HttpAccepted,
	HttpBadRequest,
	HttpInternalServerError,
} from "../_common/http/status.ts"
import { encodeHtmlEntities, telegram } from "../_common/service/telegram.ts"
import * as W from "../_common/worker/index.ts"

type ENV = {
	BA: KVNamespace
}

type KV_BA = { password: string }
type KV_BOT = {
	token: string
	chatId: number
}

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const router = new W.Router<ENV>()
		router.post(
			"/errlog",
			W.sendErrorToTelegram("errlog"),
			W.serverTiming(),
			W.basicAuth(async (user, pass, { env }) => {
				const end = W.addServerTiming("kv")
				const item = await env.BA.get<KV_BA>("errlog:" + user, {
					type: "json",
					cacheTtl: 60 * 60, // 60min
				})
				end()
				if (item?.password !== pass) return false
				return true
			}),
			async ({ req, env, ec }) => {
				const body = await req.text()
				if (body === "") return HttpBadRequest("empty body")

				const bot = await env.BA.get<KV_BOT>("telegram:err", {
					type: "json",
					cacheTtl: 60 * 60, // 60min
				})
				if (bot === null) return HttpInternalServerError("config")

				const sendMessage = telegram(bot.token, "sendMessage")
				ec.waitUntil(
					sendMessage({
						chat_id: bot.chatId,
						text: `<pre>${encodeHtmlEntities(body)}</pre>`,
						parse_mode: "HTML",
						disable_web_page_preview: true,
						disable_notification: true,
					}),
				)
				return HttpAccepted()
			},
		)
		return router.handle(req, env, ec)
	},
}
export default exportedHandler
