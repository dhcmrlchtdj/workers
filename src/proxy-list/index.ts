import * as W from "../_common/worker/index.js"
import * as R from "../_common/http/response.js"
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
			W.basicAuth(async (user, pass, { env }) => {
				const item = await env.BA.get<KVItem>("proxy:" + user, {
					type: "json",
					cacheTtl: 60 * 60, // 60min
				})
				return item?.password === pass && item
			}),
			async ({ credential }) => {
				const proxy = (credential as KVItem).proxy.join("\n")
				const b64 = toBase64(proxy)
				const resp = R.build(R.text(b64))
				return resp
			},
		)
		return router.handle(req, env, ec)
	},
}
export default exportedHandler
