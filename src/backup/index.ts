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
	BACKUP_PASS_FEEDBOX: string
	R2Backup: R2Bucket
}

const worker = createWorker("backup", (req: Request, env: ENV) => {
	if (req.method.toUpperCase() !== "POST") {
		return HttpMethodNotAllowed(["POST"])
	}

	const ct = req.headers.get("content-type")
	if (!ct?.startsWith("multipart/form-data; boundary")) {
		return HttpUnsupportedMediaType()
	}

	const [user, pass] = getBA(req.headers.get("authorization"))
	if (user === "beancount" && pass === env.BACKUP_PASS_BEANCOUNT) {
		return backupBeancount(req, env)
	} else if (user === "feedbox" && pass === env.BACKUP_PASS_FEEDBOX) {
		return backupFeedbox(req, env)
	}

	console.log(`invalid user/pass: "${user}" "${pass}"`)
	return HttpUnauthorized(["Basic"])
})

async function backupBeancount(req: Request, env: ENV): Promise<Response> {
	const body = await req.formData()
	const file = body.get("file")
	if (!(file instanceof File)) {
		throw new Error("`file` is not a file")
	}
	const obj = await env.R2Backup.put(
		`beancount/${generateFilename(file.name)}`,
		file.stream(),
		{
			httpMetadata: { contentType: "application/octet-stream" },
		},
	)
	return HttpCreated(obj.httpEtag)
}

async function backupFeedbox(req: Request, env: ENV): Promise<Response> {
	const body = await req.formData()
	const file = body.get("file")
	if (!(file instanceof File)) {
		throw new Error("`file` is not a file")
	}
	const obj = await env.R2Backup.put(
		`database/feedbox/${generateFilename(file.name)}`,
		file.stream(),
		{
			httpMetadata: { contentType: "application/octet-stream" },
		},
	)
	return HttpCreated(obj.httpEtag)
}

function generateFilename(name: string | null | undefined): string {
	const date = format(new Date(), "YYYYMMDD_hhmmss")
	if (name) {
		return date + "-" + name
	} else {
		return date
	}
}

export default worker
