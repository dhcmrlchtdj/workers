import * as W from "../_common/worker/index.js"
import * as R from "../_common/http/response.js"

///

const exportedHandler: ExportedHandler = {
	async fetch(req, env, ec) {
		const router = new W.Router()
		router.use("*", W.serverTiming())
		router.head("*", W.serveHeadWithGet())
		router.get("/", W.cacheResponse(), async () => {
			return R.build(
				R.text("Under Construction\n(maybe"),
				R.cacheControl("public, must-revalidate, max-age=86400"),
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
		return router.handle(req, env, ec)
	},
}
export default exportedHandler
