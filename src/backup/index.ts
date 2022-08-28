import { format } from "../_common/format-date.js"
import { getBA } from "../_common/basic_auth.js"
import { createWorker } from "../_common/listen.js"
import {
	HttpCreated,
	HttpMethodNotAllowed,
	HttpUnauthorized,
	HttpUnsupportedMediaType,
} from "../_common/http-response.js"

type ENV = {
	ROLLBAR_KEY: string
	BACKUP_PASS_BEANCOUNT: string
	R2Backup: R2Bucket
}

const worker = createWorker("backup", async (req: Request, env: ENV) => {
	if (req.method.toUpperCase() !== "POST") {
		return HttpMethodNotAllowed(["POST"])
	}

	const ct = req.headers.get("content-type")
	if (!ct?.startsWith("multipart/form-data; boundary")) {
		return HttpUnsupportedMediaType()
	}

	const [user, pass] = getBA(req.headers.get("authorization"))
	if (user === "beancount") {
		if (pass === env.BACKUP_PASS_BEANCOUNT) {
			const body = await req.formData()
			const file = body.get("file")
			if (!(file instanceof File)) {
				throw new Error("`file` is not a file")
			}
			const date = format(new Date(), "YYYYMMDD_hhmmss")
			const obj = await env.R2Backup.put(
				`beancount/${date}.tar.zst.age`,
				file.stream(),
				{
					httpMetadata: { contentType: "application/octet-stream" },
				},
			)
			return HttpCreated(obj.httpEtag)
		}
	}

	console.log(`invalid user/pass: "${user}" "${pass}"`)
	return HttpUnauthorized(["Basic"])
})

export default worker
