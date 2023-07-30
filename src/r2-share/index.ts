import * as M from "../_common/worker.middleware.js"
import * as R from "../_common/http/response.js"
import {
	HttpBadRequest,
	HttpNotFound,
	HttpUnauthorized,
} from "../_common/http/status.js"
import { getBA } from "../_common/http/basic_auth.js"
import { format } from "../_common/format-date.js"

type ENV = {
	BA: KVNamespace
	R2share: R2Bucket
}

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const router = new M.Router<ENV>()
		router.use(M.sendErrorToTelegram("r2-share"))
		router.route(
			["GET", "HEAD"],
			"/share/*",
			M.serveHeadWithGet(),
			M.cacheResponse(),
			async ({ req, param }) => {
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
				)
				object.writeHttpMetadata(resp.headers)

				return resp
			},
		)
		router.route(
			"PUT",
			"/share",
			M.checkContentType("multipart/form-data; boundary"),
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
					throw HttpBadRequest("`file` is not a File")
				}
				const date = format(new Date(), "YYYYMMDD_hhmmss")
				const id = String(Math.random()).slice(2)
				const name = encodeURIComponent(file.name)
				const filename = `${date}.${id}.${name}`

				const content = await file.arrayBuffer()

				const uploaded = await env.R2share.put(filename, content, {
					httpMetadata: {
						contentType: file.type ?? "application/octet-stream",
					},
				})

				const resp = R.build(
					R.status(201),
					R.header("location", "/share/" + uploaded.key),
				)
				return resp
			},
		)
		return router.handle({ req, env, ec })
	},
}
export default exportedHandler
