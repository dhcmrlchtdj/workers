import { MIME_FORM_DATA } from "../_common/http/mime.ts"
import * as R from "../_common/http/response.ts"
import { detectContentType } from "../_common/http/sniff.ts"
import { HttpBadRequest, HttpNotFound } from "../_common/http/status.ts"
import * as W from "../_common/worker/index.ts"

type ENV = {
	BA: KVNamespace
	R2share: R2Bucket
}

///

const router = new W.Router<ENV>()
router.use("*", W.sendErrorToTelegram("r2-share"), W.serverTiming())
router.head("/share/*", W.serveHeadWithGet())
router.get("/share/*", W.cacheResponse(), async ({ req, env, param }) => {
	const filename = param.get("*")!
	const end = W.addServerTiming("r2")
	const object = await env.R2share.get(filename)
	end()
	if (object === null) return HttpNotFound()

	const reqEtag = req.headers.get("If-None-Match")
	const resp = R.build(
		reqEtag?.includes(object.httpEtag)
			? R.status(304)
			: R.body(object.body),
		R.header("etag", object.httpEtag),
		R.cacheControl(
			"public, must-revalidate, s-maxage=86400, max-age=604800",
		),
		(b) => object.writeHttpMetadata(b.headers),
	)

	return resp
})
router.put(
	"/share",
	W.checkContentType(MIME_FORM_DATA),
	W.basicAuth(async (user, pass, { env }) => {
		const item = await env.BA.get<{ password: string }>("r2-share", {
			type: "json",
			cacheTtl: 60 * 60, // 60min
		})
		return user === "token" && item?.password === pass
	}),
	async ({ req, env }) => {
		const body = await req.formData()
		const file = body.get("file")
		if (!(file instanceof File)) {
			return HttpBadRequest("`file` is not a File")
		}

		const id = String(Math.random()).slice(2)
		let objectKey = `${Date.now()}.${id}`
		if (file.name) objectKey += "." + file.name

		const content = await file.arrayBuffer()

		const uploaded = await env.R2share.put(
			encodeURIComponent(objectKey),
			content,
			{
				httpMetadata: {
					contentType: file.type ?? detectContentType(content),
				},
				customMetadata: {
					via: "http-api",
				},
			},
		)

		const resp = R.build(
			R.status(201),
			R.header("location", "/share/" + uploaded.key),
		)
		return resp
	},
)

///

const exportedHandler: ExportedHandler<ENV> = {
	fetch: (req, env, ec) => router.handle(req, env, ec),
}
export default exportedHandler
