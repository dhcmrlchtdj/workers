import * as W from "../_common/worker.router.js"
import { BackBlaze } from "../_common/service/backblaze.js"
import { format } from "../_common/format-date.js"
import { getBA } from "../_common/http/basic_auth.js"
import {
	HttpAccepted,
	HttpBadRequest,
	HttpInternalServerError,
	HttpUnauthorized,
} from "../_common/http/status.js"

type ENV = {
	BA: KVNamespace
	R2apac: R2Bucket
}

type KV_BA = { password: string }
type KV_B2 = {
	id: string
	key: string
	region: string
	bucket: string
}

type Handler = (
	req: Request,
	env: ENV,
	ctx: ExecutionContext,
) => Promise<Response>
const HANDERS: Record<string, Handler> = {
	beancount: createHandler("beancount"),
	feedbox: createHandler("feedbox"),
}

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const router = new W.Router<ENV>()
		router.post(
			"/backup",
			W.sendErrorToTelegram("backup"),
			W.checkContentType("multipart/form-data; boundary"),
			async ({ req, env, ec }) => {
				const { user, pass } = getBA(req.headers.get("authorization"))
				const item = await env.BA.get<KV_BA>("backup:" + user, {
					type: "json",
					cacheTtl: 60 * 60, // 60min
				})
				if (item?.password === pass) {
					const h = HANDERS[user]
					if (h) {
						return h(req, env, ec)
					} else {
						return HttpInternalServerError()
					}
				} else {
					throw HttpUnauthorized(["Basic"])
				}
			},
		)
		return router.handle(req, env, ec)
	},
}
export default exportedHandler

///

function createHandler(directoryName: string): Handler {
	return async function (
		req: Request,
		env: ENV,
		ec: ExecutionContext,
	): Promise<Response> {
		const body = await req.formData()
		const file = body.get("file")
		if (!(file instanceof File)) {
			throw HttpBadRequest("`file` is not a File")
		}
		const filename = generateFilename(directoryName, file.name)
		const content = await file.arrayBuffer()

		const tasks = [
			uploadToBackBlaze(env, filename, content),
			uploadToCloudflare(env.R2apac, filename, content),
		]
		ec.waitUntil(Promise.allSettled(tasks))

		return HttpAccepted()
	}
}

async function uploadToCloudflare(
	bucket: R2Bucket,
	filename: string,
	file: ArrayBuffer,
) {
	await bucket.put(filename, file, {
		httpMetadata: { contentType: "application/octet-stream" },
	})
}
async function uploadToBackBlaze(
	env: ENV,
	filename: string,
	file: ArrayBuffer,
) {
	const b = await env.BA.get<KV_B2>("b2:backup", {
		type: "json",
		cacheTtl: 60 * 60, // 60min
	})
	if (b === null) {
		throw new Error("invalid b2 account")
	}
	const b2 = new BackBlaze(b.id, b.key, b.region, b.bucket)
	await b2.putObject(filename, file, "application/octet-stream")
}

function generateFilename(
	directoryName: string,
	name: string | null | undefined,
): string {
	const date = format(new Date(), "YYYYMMDD_hhmmss")
	if (name) {
		return directoryName + "/" + date + "." + encodeURIComponent(name)
	} else {
		return directoryName + "/" + date
	}
}
