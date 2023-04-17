import { getBA } from "../_common/http/basic_auth.js"
import { createWorker } from "../_common/listen.js"
import * as R from "../_common/http/response.js"
import { HttpUnauthorized } from "../_common/http/status.js"

type ENV = {
	BA: KVNamespace
	R2apac: R2Bucket
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
		const start = Date.now()
		const p = await env.R2apac.get("proxies.yaml")
		console.log(Date.now() - start)
		if (p !== null) {
			const resp = R.build(
				R.body(p.body),
				R.contentType("application/yaml; charset=utf-8"),
			)
			return resp
		} else {
			const resp = R.build(
				R.body(item.proxies),
				R.contentType("application/yaml; charset=utf-8"),
			)
			return resp
		}
	} else {
		throw HttpUnauthorized(["Basic"])
	}
})

export default worker
