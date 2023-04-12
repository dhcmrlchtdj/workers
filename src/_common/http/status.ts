export const HttpOk = (body?: BodyInit) => new Response(body, { status: 200 })
export const HttpCreated = (body?: BodyInit) =>
	new Response(body, { status: 201 })

// client error

export const HttpBadRequest = (body?: BodyInit) =>
	new Response(body, { status: 400 })
export const HttpUnauthorized = (auth: string[], body?: BodyInit) =>
	new Response(body, {
		status: 401,
		headers: {
			"WWW-Authenticate": auth.join(", "),
		},
	})
export const HttpForbidden = (body?: BodyInit) =>
	new Response(body, { status: 403 })
export const HttpNotFound = (body?: BodyInit) =>
	new Response(body, { status: 404 })
export const HttpMethodNotAllowed = (
	allowedMethods: string[],
	body?: BodyInit,
) =>
	new Response(body, {
		status: 405,
		headers: {
			Allow: allowedMethods.join(", "),
		},
	})
export const HttpUnsupportedMediaType = (body?: BodyInit) =>
	new Response(body, { status: 415 })

/// Server error

export const HttpInternalServerError = (body?: BodyInit) =>
	new Response(body, { status: 500 })
