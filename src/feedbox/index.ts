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

		const xForwardFor = appendToXForwardFor(
			req.headers.get("X-Forwarded-For"),
			req.headers.get("CF-Connecting-IP"),
		)
		if (xForwardFor) {
			req.headers.set("X-Forwarded-For", xForwardFor)
		}

		return fetch(req)
	},
}

function appendToXForwardFor(
	prev: string | null,
	clientIp: string | null,
): string | null {
	if (prev) {
		if (clientIp) {
			return prev + ", " + clientIp
		} else {
			return prev
		}
	} else {
		return clientIp
	}
}
