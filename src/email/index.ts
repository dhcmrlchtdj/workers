import { getBA } from "../_common/basic_auth.js"
import { allowMethod, contentType, createWorker } from "../_common/listen.js"
import { HttpUnauthorized } from "../_common/http-response.js"
import {
	MailChannels,
	type MailChannelsSendBody,
} from "../_common/service/mailchannel.js"

type ENV = {
	ERR_TG_BOT_TOKEN: string
	ERR_TG_CHAT_ID: string
	BA: KVNamespace
}

type KVItem = {
	password: string
	dkim: {
		dkim_domain: string
		dkim_selector: string
		dkim_private_key: string
	}
}

///

const worker = createWorker(
	"email",
	allowMethod("POST"),
	contentType("application/json"),
	async (req: Request, env: ENV) => {
		const { user, pass } = getBA(req.headers.get("authorization"))
		const item = await env.BA.get<KVItem>("email:" + user, {
			type: "json",
			cacheTtl: 60 * 60, // 60min
		})
		if (item?.password === pass) {
			const mc = new MailChannels(item.dkim)
			const mailContent = await req.json<MailChannelsSendBody>()
			const resp = await mc.sendEmail(mailContent)
			return resp
		} else {
			throw HttpUnauthorized(["Basic"])
		}
	},
)

export default worker
