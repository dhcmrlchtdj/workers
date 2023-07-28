import * as M from "../_common/worker.middleware.js"
import * as R from "../_common/http/response.js"

///

const exportedHandler: ExportedHandler = {
	async fetch(req, env, ctx) {
		const fn = M.compose(
			M.checkMethod("GET"),
			M.cacheResponse(),
			async ({ req }) => {
				const url = new URL(req.url)
				if (url.pathname === "/") {
					return R.build(
						R.body("Under Construction"),
						R.contentType("text/plain"),
						R.cacheControl("must-revalidate, max-age=86400"), // 1d
					)
				} else if (url.pathname === "/favicon.ico") {
					return R.build(
						R.body(
							'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><circle cx="1" cy="1" r="1" fill="hsl(50,100%,75%)"/></svg>',
						),
						R.contentType("image/svg+xml"),
						R.cacheControl("must-revalidate, max-age=86400"), // 1d
					)
				} else {
					return R.build(R.status(302), R.header("location", "/"))
				}
			},
		)
		return fn({ req, env, ctx })
	},
}
export default exportedHandler
