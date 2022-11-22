import { getBA } from "../_common/basic_auth.js"
import { createWorker } from "../_common/listen.js"
import {
	HttpMethodNotAllowed,
	HttpUnauthorized,
	HttpUnsupportedMediaType,
} from "../_common/http-response.js"
import { MailChannels } from "../_common/service/mailchannel.js"

type ENV = {
	ROLLBAR_KEY: string
	MAILCHANNELS_PASS_FEEDBOX: string
	MAILCHANNELS_PRIVATE_KEY: string
}

const worker = createWorker("mailchannels", (req: Request, env: ENV) => {
	if (req.method.toUpperCase() !== "POST") {
		return HttpMethodNotAllowed(["POST"])
	}

	const ct = req.headers.get("content-type")
	if (!ct?.startsWith("application/json")) {
		return HttpUnsupportedMediaType()
	}

	const [user, pass] = getBA(req.headers.get("authorization"))
	if (user === "feedbox" && pass === env.MAILCHANNELS_PASS_FEEDBOX) {
		return sendFromFeedbox(req, env)
	}

	console.log(`invalid user/pass: "${user}" "${pass}"`)
	return HttpUnauthorized(["Basic"])
})

async function sendFromFeedbox(req: Request, env: ENV): Promise<Response> {
	const mc = new MailChannels(
		{ email: "feedbox@h11.io", name: "FeedBox" },
		{
			domain: "h11.io",
			selector: "mailchannels",
			privateKey: env.MAILCHANNELS_PRIVATE_KEY,
		},
	)
	const body = await req.json<{
		to: string
		subject: string
		content: string
	}>()
	const resp = mc.sendEmail([body.to], body.subject, body.content)
	return resp
}

export default worker
