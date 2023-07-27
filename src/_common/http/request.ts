import { compose } from "./compose.js"
import { MIME_JSON } from "./mime.js"

export function build(...builders: RequestBuilder[]): Request {
	const req: RequestInner = {
		url: null,
		method: "GET",
		headers: new Headers(),
		body: null,
	}
	compose(...builders)(req)
	return new Request(req.url!, req)
}

export function get(url: string | URL): RequestBuilder {
	return (r) => {
		r.method = "GET"
		r.url = new URL(url)
	}
}
export function put(url: string | URL): RequestBuilder {
	return (r) => {
		r.method = "PUT"
		r.url = new URL(url)
	}
}
export function post(url: string | URL): RequestBuilder {
	return (r) => {
		r.method = "POST"
		r.url = new URL(url)
	}
}

export function method(m: string): RequestBuilder {
	return (r) => (r.method = m)
}

export function url(u: URL): RequestBuilder {
	return (r) => (r.url = u)
}

export function query(key: string, value: string): RequestBuilder {
	return (r) => r.url!.searchParams.set(key, value)
}

export function body(data: BodyInit): RequestBuilder {
	return (r) => (r.body = data)
}

export function headers(h: HeadersInit): RequestBuilder {
	return (r) => (r.headers = new Headers(h))
}

export function header(key: string, value: string): RequestBuilder {
	return (r) => r.headers.set(key, value)
}

export function contentType(value: string): RequestBuilder {
	return header("content-type", value)
}

export function json(data: unknown): RequestBuilder {
	return compose(body(JSON.stringify(data)), contentType(MIME_JSON))
}

export function any(fn: RequestBuilder): RequestBuilder {
	return (r) => fn(r)
}

export function noop(): RequestBuilder {
	return () => {}
}

///

type RequestInner = {
	url: URL | null
	method: string
	headers: Headers
	body?: BodyInit | null
}

type RequestBuilder = (b: RequestInner) => void
