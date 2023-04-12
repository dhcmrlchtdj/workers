import { compose } from "./compose.js"

export function build(...builders: RequestBuilder[]): Request {
	const req = {
		url: "",
		method: "GET",
		headers: new Headers(),
		body: null,
	}
	compose(...builders)(req)
	return new Request(req.url, req)
}

export function get(url: string): RequestBuilder {
	return (r) => {
		r.method = "GET"
		r.url = url
	}
}
export function put(url: string): RequestBuilder {
	return (r) => {
		r.method = "PUT"
		r.url = url
	}
}
export function post(url: string): RequestBuilder {
	return (r) => {
		r.method = "POST"
		r.url = url
	}
}

export function body(data: BodyInit): RequestBuilder {
	return (r) => (r.body = data)
}

export function header(key: string, value: string): RequestBuilder {
	return (r) => r.headers.set(key, value)
}

export function headers(h: Headers): RequestBuilder {
	return (r) => (r.headers = h)
}

export function json(data: unknown): RequestBuilder {
	return compose(
		body(JSON.stringify(data)),
		header("content-type", "application/json; charset=utf-8"),
	)
}

export function redirect(m: "follow" | "error" | "manual"): RequestBuilder {
	return (r) => (r.redirect = m)
}

export function any(fn: RequestBuilder): RequestBuilder {
	return (r) => fn(r)
}

///

type RequestInner = {
	url: string
	method: string
	headers: Headers
	body?: BodyInit | null
	redirect?: "follow" | "error" | "manual"
}

type RequestBuilder = (b: RequestInner) => void
