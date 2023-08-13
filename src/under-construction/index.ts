import * as W from "../_common/worker/index.js"
import * as R from "../_common/http/response.js"
import { HttpNotFound } from "../_common/http/status.js"

type ENV = {
	BA: KVNamespace
}

type KV_poetry = {
	author: string
	paragraphs: string[]
	rhythmic: string
}

///

const router = new W.Router<ENV>()
router.use("*", W.serverTiming())
router.head("*", W.serveHeadWithGet())
router.get("/", W.cacheResponse(), async ({ env }) => {
	const end = W.addServerTiming("kv")
	const poetry = await env.BA.get<KV_poetry[]>("poetry:song300", {
		type: "json",
		cacheTtl: 86400, // 1d
	})
	end()
	if (!poetry) return HttpNotFound()

	const idx = Math.floor(poetry.length * Math.random())
	const poem = poetry[idx]
	if (!poem) return HttpNotFound()

	return R.build(
		R.text([poem.rhythmic, poem.author, "", ...poem.paragraphs].join("\n")),
		R.cacheControl("public, must-revalidate, max-age=60"),
	)
})
router.get("/favicon.ico", W.cacheResponse(), async () => {
	const favicon =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><circle cx="1" cy="1" r="1" fill="hsl(50,100%,75%)"/></svg>'
	return R.build(
		R.svg(favicon),
		R.header("etag", '"circle-fill-hsl-50-100-75"'),
		R.cacheControl(
			"public, must-revalidate, s-maxage=86400, max-age=604800",
		),
	)
})

const exportedHandler: ExportedHandler<ENV> = {
	fetch: (req, env, ec) => router.handle(req, env, ec),
}
export default exportedHandler
