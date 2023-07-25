import * as M from "../_common/worker.middleware.js"
import * as R from "../_common/http/response.js"
import { HttpBadRequest, HttpNotFound } from "../_common/http/status.js"

type ENV = {
	BA: KVNamespace
	R2share: R2Bucket
}

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ctx) {
		const fn = M.compose<ENV>(
			M.sendErrorToTelegram("r2-share"),
			M.checkMethod("GET"),
			async ({ req, env }) => {
				const url = new URL(req.url)
				const path = url.pathname
				if (!path.startsWith("/share/")) {
					return HttpBadRequest()
				}

				const filename = path.slice(7)
				const object = await env.R2share.get(filename, {
					onlyIf: req.headers,
				} as R2GetOptions)
				if (object === null || !object.body) {
					return HttpNotFound()
				}

				const resp = R.build(
					R.body(object.body),
					R.header("etag", object.httpEtag),
				)
				object.writeHttpMetadata(resp.headers)

				return resp
			},
		)
		return fn({ req, env, ctx })
	},
}
export default exportedHandler
