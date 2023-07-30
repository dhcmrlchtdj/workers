import * as M from "../_common/worker.middleware.js"
import * as R from "../_common/http/response.js"
import { HttpBadRequest, HttpNotFound } from "../_common/http/status.js"

type ENV = {
	BA: KVNamespace
	R2share: R2Bucket
}

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const fn = M.compose<ENV>(
			M.sendErrorToTelegram("r2-share"),
			M.checkMethod("GET", "HEAD"),
			M.cacheResponse(),
			async ({ req, env }) => {
				const url = new URL(req.url)
				const path = url.pathname
				if (!path.startsWith("/share/")) return HttpBadRequest()

				const filename = path.slice(7)
				const object = await env.R2share.get(filename)
				if (object === null) return HttpNotFound()

				const reqEtag = req.headers.get("If-None-Match")
				const resp = R.build(
					reqEtag?.includes(object.httpEtag)
						? R.status(304)
						: req.method.toUpperCase() === "GET"
						? R.body(object.body)
						: R.noop(),
					R.header("etag", object.httpEtag),
					R.cacheControl(
						"public, must-revalidate, s-maxage=86400, max-age=604800",
					),
				)
				object.writeHttpMetadata(resp.headers)

				return resp
			},
		)
		return fn({ req, env, ec })
	},
}
export default exportedHandler
