export class ResponseBuilder {
	private _body: null | BodyInit
	private _status: number
	private _headers: Headers
	constructor() {
		this._body = null
		this._status = 200
		this._headers = new Headers()
	}
	build(): Response {
		return new Response(this._body, {
			status: this._status,
			headers: this._headers,
		})
	}
	body(data: BodyInit): this {
		this._body = data
		return this
	}
	status(status: number): this {
		this._status = status
		return this
	}
	append(key: string, value: string): this {
		this._headers.append(key, value)
		return this
	}
	set(key: string, value: string): this {
		this._headers.set(key, value)
		return this
	}
	///
	json(data: unknown): this {
		this.body(JSON.stringify(data))
		this.contentType("application/json; charset=utf-8")
		return this
	}
	contentType(contentType: string): this {
		this.set("content-type", contentType)
		return this
	}
	attachment(filename?: string): this {
		let v = "attachment"
		if (filename) {
			v += "; filename=" + filename
		}
		this.set("content-disposition", v)
		return this
	}
	///
	setCookie(key: string, value: string, option?: CookieOption) {
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
		this.append("set-cookie", c)
		return this
	}
	clearCookie(key: string, option?: CookieOption) {
		this.setCookie(
			key,
			"",
			option ? { ...option, maxAge: 0 } : { maxAge: 0 },
		)
		return this
	}
}

type CookieOption = {
	expires?: Date
	maxAge?: number
	domain?: string
	path?: string
	secure?: boolean
	httpOnly?: boolean
	sameSite?: "Strict" | "Lax" | "None"
}

///

export const HttpOk = (body: BodyInit = "OK") =>
	new Response(body, { status: 200 })
export const HttpCreated = (body: BodyInit = "Created") =>
	new Response(body, { status: 201 })

// client error

export const HttpBadRequest = (body: BodyInit = "Bad Request") =>
	new Response(body, { status: 400 })
export const HttpUnauthorized = (
	auth: string[],
	body: BodyInit = "Unauthorized",
) =>
	new Response(body, {
		status: 401,
		headers: {
			"WWW-Authenticate": auth.join(", "),
		},
	})
export const HttpForbidden = (body: BodyInit = "Forbidden") =>
	new Response(body, { status: 403 })
export const HttpNotFound = (body: BodyInit = "Not Found") =>
	new Response(body, { status: 404 })
export const HttpMethodNotAllowed = (
	allowedMethods: ("HEAD" | "GET" | "POST" | "PUT" | "DELETE" | "OPTION")[],
	body: BodyInit = "Method Not Allowed",
) =>
	new Response(body, {
		status: 405,
		headers: {
			Allow: allowedMethods.join(", "),
		},
	})
export const HttpUnsupportedMediaType = (
	body: BodyInit = "Unsupported Media Type",
) => new Response(body, { status: 415 })

/// Server error

export const HttpInternalServerError = (
	body: BodyInit = "Internal Server Error",
) => new Response(body, { status: 500 })
