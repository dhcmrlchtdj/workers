import * as W from "../_common/worker.router.js"
import * as R from "../_common/http/response.js"
import {
	HttpBadRequest,
	HttpNotFound,
	HttpUnauthorized,
} from "../_common/http/status.js"
import { getBA } from "../_common/http/basic_auth.js"

type ENV = {
	BA: KVNamespace
	R2share: R2Bucket
}

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const router = new W.Router<ENV>()
		router.use("/*", W.sendErrorToTelegram("r2-share"))
		router.head("/share/*", W.serveHeadWithGet())
		router.get("/share/*", W.cacheResponse(), async ({ req, param }) => {
			const filename = param.get("*")
			const object = await env.R2share.get(filename!)
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
			W.checkContentType("multipart/form-data; boundary"),
			async ({ req, env }) => {
				const { pass } = getBA(req.headers.get("authorization"))
				const item = await env.BA.get<{ password: string }>(
					"r2-share",
					{
						type: "json",
						cacheTtl: 60 * 60, // 60min
					},
				)
				if (!(item && item.password === pass)) {
					return HttpUnauthorized(["Basic"])
				}

				///

				const body = await req.formData()
				const file = body.get("file")
				if (!(file instanceof File)) {
					return HttpBadRequest("`file` is not a File")
				}
				const id = String(Math.random()).slice(2)
				const objectKey = `${Date.now()}.${id}.${file.name}`

				const content = await file.arrayBuffer()

				const uploaded = await env.R2share.put(
					encodeURIComponent(objectKey),
					content,
					{
						httpMetadata: {
							contentType:
								file.type ?? "application/octet-stream",
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
		return router.handle(req, env, ec)
	},
}
export default exportedHandler
