import * as W from "../_common/worker.router.js"
import { getBA } from "../_common/http/basic_auth.js"
import {
	encodeHtmlEntities as enc,
	telegram,
} from "../_common/service/telegram.js"
import {
	HttpBadRequest,
	HttpOk,
	HttpUnauthorized,
} from "../_common/http/status.js"

type ENV = {
	BA: KVNamespace
}

type KVItem = { password: string; ip: string }

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const router = new W.Router<ENV>()
		router.get(
			"/current-ip",
			W.sendErrorToTelegram("current-ip"),
			async ({ req, env }) => {
				const currIp = req.headers.get("CF-Connecting-IP")
				if (currIp === null) {
					return HttpBadRequest("CF-Connecting-IP is missed")
				}

				const { user, pass } = getBA(req.headers.get("authorization"))
				const item = await env.BA.get<KVItem>("ip:" + user, {
					type: "json",
				})
				if (item?.password === pass) {
					await saveCurrentIp(env, user, item, currIp)
					return HttpOk(currIp)
				} else {
					console.log(`invalid user/pass: "${user}" "${pass}"`)
					return HttpUnauthorized(["Basic"])
				}
			},
		)
		return router.handle(req, env, ec)
	},
}
export default exportedHandler

///

async function saveCurrentIp(
	env: ENV,
	machine: string,
	item: KVItem,
	currIp: string,
) {
	if (item.ip !== currIp) {
		item.ip = currIp
		await env.BA.put("ip:" + machine, JSON.stringify(item))

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
			text: `IP changed: ${enc(machine)}\n<pre>HostName ${enc(
				currIp,
			)}</pre>`,
			disable_web_page_preview: true,
		})
	}
}
