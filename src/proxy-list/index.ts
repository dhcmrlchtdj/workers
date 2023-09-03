import * as W from "../_common/worker/index.ts"
import * as R from "../_common/http/response.ts"
import { toBase64 } from "../_common/base64.ts"

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
			W.serverTiming(),
			W.basicAuth(async (user, pass, { env }) => {
				const end = W.addServerTiming("kv")
				const item = await env.BA.get<KVItem>("proxy:" + user, {
					type: "json",
					cacheTtl: 60 * 60, // 60min
				})
				end()
				if (item?.password !== pass) return false
				W.setInContext("credential", item)
				return true
			}),
			() => {
				const item = W.getInContext<KVItem>("credential")
				const proxy = item.proxy.join("\n")
				const b64 = toBase64(proxy)
				const resp = R.build(R.text(b64))
				return resp
			},
		)
		return router.handle(req, env, ec)
	},
}
export default exportedHandler
