import { HttpInternalServerError } from "../_common/http/status.ts"
import * as W from "../_common/worker/index.ts"
import { auth, shuffle } from "./util.ts"

type ENV = {
	BA: KVNamespace
}

type Server = {
	url: string
	key: string
}

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const router = new W.Router<ENV>()

		router.post(
			"/openai/v1/*",
			W.sendErrorToTelegram("openai"),
			auth,
			async ({ req, env, param }) => {
				const servers = await env.BA.get<Server[]>("openai:server", {
					type: "json",
					cacheTtl: 1800,
				})

				if (!servers || servers.length === 0) {
					return HttpInternalServerError()
				}

				const suffix = param.get("*")!
				const search = new URL(req.url).search

				const shuffled = shuffle(servers)
				let resp: Response | null = null
				for (const server of shuffled) {
					try {
						const target = server.url + "/" + suffix + search
						const headers = new Headers(req.headers)
						headers.set("Authorization", `Bearer ${server.key}`)

						resp = await fetch(target, {
							method: "POST",
							headers: headers,
							body: req.body,
							redirect: "manual",
						})

						if (resp.ok) {
							return resp
						}
					} catch (e) {
						resp = HttpInternalServerError(String(e))
					}
				}
				return resp
			},
		)

		return router.handle(req, env, ec)
	},
}

export default exportedHandler
