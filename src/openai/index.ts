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
	model: string
}

const exportedHandler: ExportedHandler<ENV> = {
	fetch(req, env, ec) {
		const router = new W.Router<ENV>()

		router.post(
			"/openai/v1/*",
			W.sendErrorToTelegram("openai"),
			authMiddleware,
			({ req, env, param }) => proxyRequest(req, env, param),
		)

		return router.handle(req, env, ec)
	},
}

export default exportedHandler

/* ---------------- auth ---------------- */

async function authMiddleware(ctx: RouterContext<ENV>, next: NextFn<ENV>) {
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

/* ---------------- proxy core ---------------- */

async function proxyRequest(
	req: Request,
	env: ENV,
	param: Map<string, string>,
): Promise<Response> {
	const servers = await env.BA.get<Server[]>("openai:server", {
		type: "json",
		cacheTtl: 1800,
	})

	if (!servers || servers.length === 0) {
		await reportError(env, "no backend servers configured", {
			path: param.get("*"),
		})
		return HttpInternalServerError("no backend servers")
	}

	const shuffled = shuffle([...servers])
	let lastErr: { status: number; statusText: string; body?: string } | null =
		null
	const suffix = param.get("*")!
	const search = new URL(req.url).search

	for (const server of shuffled) {
		try {
			const target = server.url + "/" + suffix + search
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

			// 记录上游错误（但不立即返回，继续尝试其他 server）
			lastErr = {
				status: resp.status,
				statusText: resp.statusText,
				body: await resp.text().catch(() => undefined),
			}

			// 上报 5xx 错误
			if (resp.status >= 500) {
				await reportError(env, `upstream ${resp.status}`, {
					backend: server.url,
					model: server.model,
					path: suffix,
					response: lastErr.body?.slice(0, 500),
				})
			}
		} catch (e) {
			// 网络/超时等异常
			await reportError(env, `fetch error: ${String(e)}`, {
				backend: server.url,
				model: server.model,
				path: suffix,
			})
			lastErr = { status: 502, statusText: String(e) }
		}
	}

	// 所有 backend 都失败了，上报聚合异常
	await reportError(env, "all backends failed", {
		path: suffix,
		lastError: lastErr,
		attempted: shuffled.map((s) => ({ url: s.url, model: s.model })),
	})

	return HttpInternalServerError("all backends failed")
}

/* ---------------- error reporting ---------------- */

async function reportError(
	env: ENV,
	message: string,
	context: Record<string, unknown>,
): Promise<void> {
	try {
		const payload = JSON.stringify({
			service: "openai",
			message,
			context,
			time: new Date().toISOString(),
		})

		// 通过 Bot API 或 Webhook 上报（先存 KV，由 errlog worker 消费）
		await env.BA.put(
			`error:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
			payload,
			{ expirationTtl: 86400 }, // 1天后过期
		)
	} catch {
		// 上报失败静默处理，避免影响主流程
	}
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
