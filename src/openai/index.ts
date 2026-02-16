import type { NextFn, RouterContext } from "../_common/worker/type.ts"
import {
	HttpForbidden,
	HttpInternalServerError,
} from "../_common/http/status.ts"
import * as W from "../_common/worker/index.ts"

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
			"/openai/v1/chat/completions",
			W.sendErrorToTelegram("openai"),
			auth,
			async ({ req, env }) => {
				const servers = await env.BA.get<Server[]>("openai:server", {
					type: "json",
					cacheTtl: 1800,
				})
				if (!servers || servers.length === 0) {
					return HttpInternalServerError("no servers available")
				}
				const idx = Math.floor(Math.random() * servers.length)
				const server = servers[idx]!

				const search = new URL(req.url).search
				const target = server.url + "/chat/completions" + search
				const headers = new Headers(req.headers)
				headers.set("Authorization", `Bearer ${server.key}`)

				return fetch(target, {
					method: "POST",
					headers,
					body: req.body,
					redirect: "manual",
				})
			},
		)

		return router.handle(req, env, ec)
	},
}

export default exportedHandler

async function auth(ctx: RouterContext<ENV>, next: NextFn<ENV>) {
	let userKey: string | null = null

	const auth = ctx.req.headers.get("authorization")
	if (auth?.startsWith("Bearer ")) {
		userKey = auth.slice(7)
	} else {
		userKey = ctx.req.headers.get("api-key")
	}

	if (!userKey) {
		return HttpForbidden("missing token")
	}

	const realKey = await ctx.env.BA.get("openai:auth", {
		type: "text",
		cacheTtl: 3600,
	})

	if (!realKey || realKey !== userKey) {
		return HttpForbidden("invalid token")
	}

	return next(ctx)
}
