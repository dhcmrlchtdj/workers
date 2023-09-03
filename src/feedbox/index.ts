import * as S from "../_common/http/request.ts"

export default {
	async fetch(request: Request) {
		const host = "feedbox.h11.dev"

		const req = S.build(
			S.method(request.method),
			S.url(request.url),
			S.headers(request.headers),
			S.body(request.body),
			(b) => (b.url!.host = host),
			S.header("host", host),
			(b) => {
				const xForwardFor = appendIpToXForwardFor(
					request.headers.get("X-Forwarded-For"),
					request.headers.get("CF-Connecting-IP"),
				)
				if (xForwardFor) {
					b.headers.set("x-forwarded-for", xForwardFor)
				}
			},
		)
		return fetch(req, { redirect: "manual" })
	},
}

function appendIpToXForwardFor(
	xForwardFor: string | null,
	ip: string | null,
): string | null {
	if (!ip) return xForwardFor
	if (!xForwardFor) return ip
	return xForwardFor + "," + ip
}
