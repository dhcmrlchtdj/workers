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
		return fetch(req)
	},
}
