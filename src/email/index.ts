import { getBA } from "../_common/basic_auth.js"
import { allowMethod, contentType, createWorker } from "../_common/listen.js"
import { HttpUnauthorized } from "../_common/http-response.js"
import {
	sendEmail,
	type MailChannelsSendBody,
} from "../_common/service/mailchannel.js"

type ENV = {
	BA: KVNamespace
}

type KVItem = {
	password: string
	dkim: {
		dkim_domain: string
		dkim_selector: string
		dkim_private_key: string
	}
	from: {
		email: string
		name: string
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
			const mailContent = await req.json<MailChannelsSendBody>()
			mailContent.from = mailContent.from ?? item.from
			mailContent.personalizations = mailContent.personalizations.map(
				(t) => ({ ...item.dkim, ...t }),
			)
			const resp = await sendEmail(mailContent)
			return resp
		} else {
			throw HttpUnauthorized(["Basic"])
		}
	},
)

export default worker
