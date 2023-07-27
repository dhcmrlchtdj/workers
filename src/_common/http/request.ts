import { type Builder, compose } from "./compose.js"

export * from "./compose.js"

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

export function get(u: string | URL): RequestBuilder {
	return compose(method("GET"), url(u))
}
export function put(u: string | URL): RequestBuilder {
	return compose(method("PUT"), url(u))
}
export function post(u: string | URL): RequestBuilder {
	return compose(method("POST"), url(u))
}

export function method(m: string): RequestBuilder {
	return (r) => (r.method = m)
}

export function url(u: URL | string): RequestBuilder {
	return (r) => (r.url = new URL(u))
}

export function query(key: string, value: string): RequestBuilder {
	return (r) => r.url!.searchParams.set(key, value)
}

///

type RequestInner = {
	url: URL | null
	method: string
	headers: Headers
	body?: BodyInit | null
}

type RequestBuilder = Builder<RequestInner>
