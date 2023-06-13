import * as M from "../_common/worker.middleware.js"
import * as R from "../_common/http/response.js"
import { HttpUnauthorized } from "../_common/http/status.js"
import { MIME_TEXT } from "../_common/http/mime.js"
import { getBA } from "../_common/http/basic_auth.js"
import { toBase64 } from "../_common/base64.js"

type ENV = {
	BA: KVNamespace
}

type KVItem = { password: string; proxy: string[] }

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ctx) {
		const fn = M.compose<ENV>(
			M.sendErrorToTelegram("proxy-list"),
			async ({ req, env }) => {
				const { user, pass } = getBA(req.headers.get("authorization"))
				const item = await env.BA.get<KVItem>("proxy:" + user, {
					type: "json",
					cacheTtl: 60 * 60, // 60min
				})
				if (item?.password === pass) {
					const proxy = item.proxy.join("\n")
					const b64 = toBase64(proxy)
					const resp = R.build(R.body(b64), R.contentType(MIME_TEXT))
					return resp
				} else {
					throw HttpUnauthorized(["Basic"])
				}
			},
		)
		return fn({ req, env, ctx })
	},
}
export default exportedHandler
