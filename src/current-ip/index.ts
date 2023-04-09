import {
	Telegram,
	encodeHtmlEntities as enc,
} from "../_common/service/telegram.js"
import { getBA } from "../_common/basic_auth.js"
import { createWorker } from "../_common/listen.js"
import {
	HttpBadRequest,
	HttpOk,
	HttpUnauthorized,
} from "../_common/http-response.js"

type ENV = {
	ROLLBAR_KEY: string
	ROLLBAR_TG_BOT_TOKEN: string
	ROLLBAR_TG_CHAT_ID: string
	BA: KVNamespace
}

type KVItem = { password: string; ip: string }

///

const worker = createWorker("current-ip", async (req: Request, env: ENV) => {
	const currIp = req.headers.get("CF-Connecting-IP")
	if (currIp === null) {
		return HttpBadRequest("CF-Connecting-IP is missed")
	}

	const { user, pass } = getBA(req.headers.get("authorization"))
	const item = await env.BA.get<KVItem>("ip:" + user, { type: "json" })
	if (item?.password === pass) {
		await saveCurrentIp(env, user, item, currIp)
		return HttpOk(currIp)
	} else {
		console.log(`invalid user/pass: "${user}" "${pass}"`)
		return HttpUnauthorized(["Basic"])
	}
})

export default worker

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
		const telegram = new Telegram(env.ROLLBAR_TG_BOT_TOKEN)
		await telegram.send("sendMessage", {
			parse_mode: "HTML",
			chat_id: Number(env.ROLLBAR_TG_CHAT_ID),
			text: `IP changed: ${enc(machine)}\n<pre>HostName ${enc(
				currIp,
			)}</pre>`,
			disable_web_page_preview: true,
		})
	}
}
