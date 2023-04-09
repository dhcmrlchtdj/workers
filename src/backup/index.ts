import { format } from "../_common/format-date.js"
import { getBA } from "../_common/basic_auth.js"
import { allowMethod, contentType, createWorker } from "../_common/listen.js"
import {
	HttpInternalServerError,
	HttpUnauthorized,
	ResponseBuilder,
} from "../_common/http-response.js"
import { BackBlaze } from "../_common/service/backblaze.js"

type ENV = {
	ROLLBAR_KEY: string
	R2Backup: R2Bucket
	BA: KVNamespace
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
	feedbox: createHandler("database/feedbox"),
}

///

const worker = createWorker(
	"backup",
	allowMethod("POST"),
	contentType("multipart/form-data; boundary"),
	async (req: Request, env: ENV, ctx: ExecutionContext) => {
		const { user, pass } = getBA(req.headers.get("authorization"))
		const item = await env.BA.get<KV_BA>("backup:" + user, {
			type: "json",
			cacheTtl: 60 * 60, // 60min
		})
		if (item?.password === pass) {
			const h = HANDERS[user]
			if (h) {
				return h(req, env, ctx)
			} else {
				return HttpInternalServerError()
			}
		} else {
			throw HttpUnauthorized(["Basic"])
		}
	},
)

export default worker

///

function createHandler(directoryName: string): Handler {
	return async function (
		req: Request,
		env: ENV,
		ctx: ExecutionContext,
	): Promise<Response> {
		const body = await req.formData()
		const file = body.get("file")
		if (!(file instanceof File)) {
			throw new Error("`file` is not a file")
		}
		const filename = generateFilename(directoryName, file.name)
		const content = await file.arrayBuffer()

		const tasks = [
			uploadToBackBlaze(env, filename, content),
			uploadToCloudflare(env.R2Backup, filename, content),
		]
		ctx.waitUntil(Promise.allSettled(tasks))
		await Promise.any(tasks)

		return new ResponseBuilder()
			.status(201)
			.json({ msg: "created" })
			.build()
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
		return directoryName + "/" + date + "-" + name
	} else {
		return directoryName + "/" + date
	}
}
