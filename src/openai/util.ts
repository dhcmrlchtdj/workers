import type { NextFn, RouterContext } from "../_common/worker/type"
import { HttpForbidden } from "../_common/http/status"

type ENV = {
	BA: KVNamespace
}

export async function auth(ctx: RouterContext<ENV>, next: NextFn<ENV>) {
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

export function shuffle<T>(arr: T[]): T[] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const a = arr[i]!
		arr[i] = arr[j]!
		arr[j] = a
	}
	return arr
}
