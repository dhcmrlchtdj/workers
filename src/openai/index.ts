import {
	HttpForbidden,
	HttpInternalServerError,
} from "../_common/http/status.ts"
import * as W from "../_common/worker/index.ts"
import type { NextFn, RouterContext } from "../_common/worker/type.ts"

type ENV = {
	BA: KVNamespace
}

type Server = {
	url: string
	key: string
	model: string
}

const exportedHandler: ExportedHandler<ENV> = {
	fetch(req, env, ec) {
		const router = new W.Router<ENV>()

		router.post(
			"/openai/v1/*",
			W.sendErrorToTelegram("openai"),
			W.serverTiming(),
			authMiddleware,
			({ req, env, param }) => proxyRequest(req, env, param),
		)

		return router.handle(req, env, ec)
	},
}

export default exportedHandler

/* ---------------- auth ---------------- */

async function authMiddleware(ctx: RouterContext<ENV>, next: NextFn<ENV>) {
	// 支持 Authorization: Bearer xxx 以及 api-key
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
		cacheTtl: 60,
	})

	if (!realKey || realKey !== userKey) {
		return HttpForbidden("invalid token")
	}

	return next(ctx)
}

/* ---------------- proxy core ---------------- */

async function proxyRequest(
	req: Request,
	env: ENV,
	param: Map<string, string>,
): Promise<Response> {
	const servers = await env.BA.get<Server[]>("openai:server", {
		type: "json",
		cacheTtl: 60,
	})

	if (!servers || servers.length === 0) {
		return HttpInternalServerError("no backend servers")
	}

	// shuffle
	const shuffled = shuffle([...servers])

	let lastErr: Response | null = null
	const suffix = param.get("*")!

	for (const server of shuffled) {
		try {
			const search = new URL(req.url).search
			const target = server.url + "/" + suffix + search

			// clone headers and add auth key
			const headers = new Headers(req.headers)
			headers.set("Authorization", `Bearer ${server.key}`)

			const resp = await fetch(target, {
				method: "POST",
				headers: headers,
				body: req.body,
				redirect: "manual",
			})

			if (resp.ok) {
				return resp
			}

			lastErr = resp
		} catch (e) {
			lastErr = HttpInternalServerError(String(e))
		}
	}

	return lastErr ?? HttpInternalServerError("all backends failed")
}

/* ---------------- utils ---------------- */

function shuffle<T>(arr: T[]): T[] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const a = arr[i]!
		arr[i] = arr[j]!
		arr[j] = a
	}
	return arr
}
