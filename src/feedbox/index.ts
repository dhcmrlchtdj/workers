export default {
	async fetch(request: Request) {
		const host = "feedbox.h11.dev"
		const url = new URL(request.url)
		url.host = host
		const req = new Request(url.toString(), {
			method: request.method,
			headers: request.headers,
			body: request.body,
			redirect: "manual",
		})
		req.headers.set("host", host)

		const xForwardFor = appendIpToXForwardFor(
			req.headers.get("X-Forwarded-For"),
			req.headers.get("CF-Connecting-IP"),
		)
		if (xForwardFor) {
			req.headers.set("X-Forwarded-For", xForwardFor)
		}

		return fetch(req)
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
