import * as W from "../_common/worker/index.js"
import {
	encodeHtmlEntities as enc,
	telegram,
} from "../_common/service/telegram.js"
import { HttpBadRequest, HttpOk } from "../_common/http/status.js"

type ENV = {
	BA: KVNamespace
}

type KVItem = { username: string; password: string; ip: string }

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const router = new W.Router<ENV>()
		router.get(
			"/current-ip",
			W.sendErrorToTelegram("current-ip"),
			W.serverTiming(),
			W.basicAuth(async (user, pass, { env }) => {
				const item = await env.BA.get<KVItem>("ip:" + user, {
					type: "json",
				})
				if (item?.password !== pass) return false
				W.setInContext("credential", item)
				return true
			}),
			async ({ req, env }) => {
				const currIp = req.headers.get("CF-Connecting-IP")
				if (currIp === null) {
					return HttpBadRequest("CF-Connecting-IP is missed")
				}
				const item = W.getInContext("credential") as KVItem
				await saveCurrentIp(env, item, currIp)
				return HttpOk(currIp)
			},
		)
		return router.handle(req, env, ec)
	},
}
export default exportedHandler

///

async function saveCurrentIp(env: ENV, item: KVItem, currIp: string) {
	if (item.ip === currIp) return

	item.ip = currIp
	await env.BA.put("ip:" + item.username, JSON.stringify(item))

	const tg = await env.BA.get<{
		token: string
		chatId: number
	}>("telegram:err", {
		type: "json",
		cacheTtl: 60 * 60, // 60min
	})
	if (tg === null) return

	const sendMessage = telegram(tg.token, "sendMessage")
	await sendMessage({
		parse_mode: "HTML",
		chat_id: tg.chatId,
		text: `IP changed: ${enc(item.username)}\n<pre>HostName ${enc(
			currIp,
		)}</pre>`,
		disable_web_page_preview: true,
	})
}
