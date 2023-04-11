export function build(...builders: ResponseBuilder[]): Response {
	const b = { body: null, status: 200, headers: new Headers() }
	compose(...builders)(b)
	return new Response(b.body, { status: b.status, headers: b.headers })
}

export function compose(...builders: ResponseBuilder[]): ResponseBuilder {
	return (b: ResponseLike) => {
		for (const builder of builders) {
			builder(b)
		}
	}
}

export function body(data: BodyInit): ResponseBuilder {
	return (b: ResponseLike) => (b.body = data)
}

export function status(status: number): ResponseBuilder {
	return (b: ResponseLike) => (b.status = status)
}

export function append(key: string, value: string): ResponseBuilder {
	return (b: ResponseLike) => b.headers.append(key, value)
}

export function set(key: string, value: string): ResponseBuilder {
	return (b: ResponseLike) => b.headers.set(key, value)
}

export function contentType(type: string): ResponseBuilder {
	return set("content-type", type)
}

export function json(data: unknown): ResponseBuilder {
	return (b: ResponseLike) => {
		b.body = JSON.stringify(data)
		b.headers.set("content-type", "application/json; charset=utf-8")
	}
}

export function attachment(filename?: string): ResponseBuilder {
	return (b: ResponseLike) => {
		let v = "attachment"
		if (filename) {
			v += "; filename=" + filename
		}
		b.headers.set("content-disposition", v)
	}
}

export function setCookie(
	key: string,
	value: string,
	option?: CookieOption,
): ResponseBuilder {
	return (b: ResponseLike) => {
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
		b.headers.set("set-cookie", c)
	}
}
export function clearCookie(
	key: string,
	option: CookieOption,
): ResponseBuilder {
	return setCookie(key, "", option ? { ...option, maxAge: 0 } : { maxAge: 0 })
}

type ResponseLike = {
	body: null | BodyInit
	status: number
	headers: Headers
}

type ResponseBuilder = (b: ResponseLike) => void

export type CookieOption = {
	expires?: Date
	maxAge?: number
	domain?: string
	path?: string
	secure?: boolean
	httpOnly?: boolean
	sameSite?: "Strict" | "Lax" | "None"
}
