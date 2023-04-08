import { getBA } from "../_common/basic_auth.js"
import { createWorker } from "../_common/listen.js"
import {
	HttpMethodNotAllowed,
	HttpUnauthorized,
	HttpUnsupportedMediaType,
} from "../_common/http-response.js"
import {
	MailChannels,
	type MailChannelsSendBody,
} from "../_common/service/mailchannel.js"

type ENV = {
	ROLLBAR_KEY: string
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

const worker = createWorker("email", async (req: Request, env: ENV) => {
	if (req.method.toUpperCase() !== "POST") {
		return HttpMethodNotAllowed(["POST"])
	}

	const ct = req.headers.get("content-type")
	if (!ct?.startsWith("application/json")) {
		return HttpUnsupportedMediaType()
	}

	const { user, pass } = getBA(req.headers.get("authorization"))
	const item = await env.BA.get<KVItem>("email:" + user, {
		type: "json",
		cacheTtl: 60 * 60, // 60min
	})
	if (user && item && item.password === pass) {
		const mc = new MailChannels(item.dkim)
		const mailContent = await req.json<MailChannelsSendBody>()
		const resp = await mc.sendEmail(mailContent)
		return resp
	} else {
		console.log(`invalid user/pass: "${user}" "${pass}"`)
		return HttpUnauthorized(["Basic"])
	}
})

export default worker
