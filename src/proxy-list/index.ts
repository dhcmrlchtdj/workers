import { getBA } from "../_common/basic_auth.js"
import { HttpUnauthorized } from "../_common/http-response.js"
import { createWorker } from "../_common/listen.js"

type ENV = {
	PROXY: KVNamespace
	ROLLBAR_KEY: string
}
type ProxyItem = {
	username: string
	password: string
	proxies: string
}

const worker = createWorker("proxy-list", async (req: Request, env: ENV) => {
	const _proxyList = await env.PROXY.get("proxy")
	if (_proxyList === null) {
		console.log(`proxy list is empty`)
		return HttpUnauthorized(["Basic"])
	}
	const proxyList = JSON.parse(_proxyList) as ProxyItem[]

	const { user, pass } = getBA(req.headers.get("authorization"))
	for (const { username, password, proxies } of proxyList) {
		if (user === username && pass === password) {
			return respAsYAML(proxies)
		}
	}

	console.log(`invalid user/pass: "${user}" "${pass}"`)
	return HttpUnauthorized(["Basic"])
})

export default worker

function respAsYAML(body: string) {
	return new Response(body, {
		status: 200,
		statusText: "OK",
		headers: {
			"content-type": "application/yaml;charset=UTF-8",
		},
	})
}
