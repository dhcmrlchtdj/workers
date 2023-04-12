import { compose } from "./compose.js"

export function build(...builders: ResponseBuilder[]): Response {
	const b = { body: null, status: 200, headers: new Headers() }
	compose(...builders)(b)
	return new Response(b.body, { status: b.status, headers: b.headers })
}

export function body(data: BodyInit): ResponseBuilder {
	return (b) => (b.body = data)
}

export function status(status: number): ResponseBuilder {
	return (b) => (b.status = status)
}

export function header(key: string, value: string): ResponseBuilder {
	return (b) => b.headers.set(key, value)
}

export function contentType(type: string): ResponseBuilder {
	return header("content-type", type)
}

export function json(data: unknown): ResponseBuilder {
	return compose(
		body(JSON.stringify(data)),
		contentType("application/json; charset=utf-8"),
	)
}

export function attachment(filename?: string): ResponseBuilder {
	let v = "attachment"
	if (filename) {
		v += "; filename=" + filename
	}
	return header("content-disposition", v)
}

export function setCookie(
	key: string,
	value: string,
	option?: CookieOption,
): ResponseBuilder {
	let c = encodeURIComponent(key) + "=" + encodeURIComponent(value)
	if (option) {
		if (option.expires) c += "; Expires=" + option.expires.toUTCString()
		if (Number.isInteger(option.maxAge))
			c += "; Max-Age=" + option.maxAge!.toString()
		if (option.domain) c += "; Domain=" + option.domain
		if (option.path) c += "; Path=" + option.path
		if (option.secure) c += "; Secure"
		if (option.httpOnly) c += "; HttpOnly"
		if (option.sameSite) c += "; SameSite=" + option.sameSite
	}
	return (b) => b.headers.append("set-cookie", c)
}

export function clearCookie(
	key: string,
	option: CookieOption,
): ResponseBuilder {
	return setCookie(key, "", option ? { ...option, maxAge: 0 } : { maxAge: 0 })
}

export function any(fn: ResponseBuilder): ResponseBuilder {
	return (r) => fn(r)
}

///

type ResponseInner = {
	body: null | BodyInit
	status: number
	headers: Headers
}

type ResponseBuilder = (b: ResponseInner) => void

export type CookieOption = {
	expires?: Date
	maxAge?: number
	domain?: string
	path?: string
	secure?: boolean
	httpOnly?: boolean
	sameSite?: "Strict" | "Lax" | "None"
}
