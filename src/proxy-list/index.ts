import * as W from "../_common/worker.router.js"
import * as R from "../_common/http/response.js"
import { HttpUnauthorized } from "../_common/http/status.js"
import { getBA } from "../_common/http/basic_auth.js"
import { toBase64 } from "../_common/base64.js"

type ENV = {
	BA: KVNamespace
}

type KVItem = { password: string; proxy: string[] }

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const router = new W.Router<ENV>()
		router.get(
			"/proxy-list",
			W.sendErrorToTelegram("proxy-list"),
			async ({ req, env }) => {
				const { user, pass } = getBA(req.headers.get("authorization"))
				const item = await env.BA.get<KVItem>("proxy:" + user, {
					type: "json",
					cacheTtl: 60 * 60, // 60min
				})
				if (item?.password === pass) {
					const proxy = item.proxy.join("\n")
					const b64 = toBase64(proxy)
					const resp = R.build(R.text(b64))
					return resp
				} else {
					return HttpUnauthorized(["Basic"])
				}
			},
		)
		return router.handle(req, env, ec)
	},
}
export default exportedHandler
