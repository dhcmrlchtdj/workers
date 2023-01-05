import { getBA } from "../_common/basic_auth.js"
import { HttpUnauthorized, ResponseBuilder } from "../_common/http-response.js"
import { createWorker } from "../_common/listen.js"

type ENV = {
	ROLLBAR_KEY: string
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
	if (user && item?.password === pass) {
		const resp = new ResponseBuilder()
			.body(item.proxies)
			.contentType("application/yaml; charset=utf-8")
			.build()
		return resp
	} else {
		console.log(`invalid user/pass: "${user}" "${pass}"`)
		return HttpUnauthorized(["Basic"])
	}
})

export default worker
