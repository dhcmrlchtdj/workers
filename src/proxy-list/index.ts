import { getBA } from "../_common/basic_auth.js"
import { HttpUnauthorized } from "../_common/http-response.js"
import { createWorker } from "../_common/listen.js"
import * as R from "../_common/response-builder.js"

type ENV = {
	BA: KVNamespace
}

type KVItem = { password: string; proxies: string }

///

const worker = createWorker("proxy-list", async (req: Request, env: ENV) => {
	const { user, pass } = getBA(req.headers.get("authorization"))
	const item = await env.BA.get<KVItem>("proxy:" + user, {
		type: "json",
		cacheTtl: 60 * 60, // 60min
	})
	if (item?.password === pass) {
		const resp = R.build(
			R.body(item.proxies),
			R.contentType("application/yaml; charset=utf-8"),
		)
		return resp
	} else {
		throw HttpUnauthorized(["Basic"])
	}
})

export default worker
