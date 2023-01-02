import { getBA } from "../_common/basic_auth.js"
import { HttpUnauthorized } from "../_common/http-response.js"
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
		cacheTtl: 60 * 60 * 3, // 3h
	})
	if (user && item?.password === pass) {
		return respAsYAML(item.proxies)
	} else {
		console.log(`invalid user/pass: "${user}" "${pass}"`)
		return HttpUnauthorized(["Basic"])
	}
})

export default worker

///

function respAsYAML(body: string) {
	return new Response(body, {
		status: 200,
		statusText: "OK",
		headers: {
			"content-type": "application/yaml;charset=UTF-8",
		},
	})
}
