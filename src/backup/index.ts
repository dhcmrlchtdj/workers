import { format } from "../_common/format-date.js"
import { getBA } from "../_common/basic_auth.js"
import { createWorker } from "../_common/listen.js"
import {
	HttpCreated,
	HttpInternalServerError,
	HttpMethodNotAllowed,
	HttpUnauthorized,
	HttpUnsupportedMediaType,
} from "../_common/http-response.js"

type ENV = {
	ROLLBAR_KEY: string
	R2Backup: R2Bucket
	BA: KVNamespace
}

type KVItem = { password: string }

type Handler = (req: Request, env: ENV) => Promise<Response>
const HANDERS: Record<string, Handler> = {
	beancount: createHandler("beancount"),
	feedbox: createHandler("database/feedbox"),
}

///

const worker = createWorker("backup", async (req: Request, env: ENV) => {
	if (req.method.toUpperCase() !== "POST") {
		return HttpMethodNotAllowed(["POST"])
	}

	const ct = req.headers.get("content-type")
	if (!ct?.startsWith("multipart/form-data; boundary")) {
		return HttpUnsupportedMediaType()
	}

	const { user, pass } = getBA(req.headers.get("authorization"))
	const item = await env.BA.get<KVItem>("backup:" + user, {
		type: "json",
		cacheTtl: 60 * 60, // 1h
	})
	if (user && item?.password === pass) {
		const h = HANDERS[user]
		if (h) {
			return h(req, env)
		} else {
			return HttpInternalServerError()
		}
	} else {
		console.log(`invalid user/pass: "${user}" "${pass}"`)
		return HttpUnauthorized(["Basic"])
	}
})

export default worker

///

function createHandler(directoryName: string): Handler {
	return async function (req: Request, env: ENV): Promise<Response> {
		const body = await req.formData()
		const file = body.get("file")
		if (!(file instanceof File)) {
			throw new Error("`file` is not a file")
		}
		const obj = await env.R2Backup.put(
			generateFilename(directoryName, file.name),
			file.stream(),
			{
				httpMetadata: { contentType: "application/octet-stream" },
			},
		)
		return HttpCreated(obj.httpEtag)
	}
}

function generateFilename(
	directoryName: string,
	name: string | null | undefined,
): string {
	const date = format(new Date(), "YYYYMMDD_hhmmss")
	if (name) {
		return directoryName + "/" + date + "-" + name
	} else {
		return directoryName + "/" + date
	}
}
