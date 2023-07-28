export const HttpOk = (body: BodyInit = "200") =>
	new Response(body, { status: 200 })
export const HttpCreated = (body: BodyInit = "201") =>
	new Response(body, { status: 201 })

// client error

export const HttpBadRequest = (body: BodyInit = "400") =>
	new Response(body, { status: 400 })
export const HttpUnauthorized = (auth: string[], body: BodyInit = "401") =>
	new Response(body, {
		status: 401,
		headers: {
			"WWW-Authenticate": auth.join(", "),
		},
	})
export const HttpForbidden = (body: BodyInit = "403") =>
	new Response(body, { status: 403 })
export const HttpNotFound = (body: BodyInit = "404") =>
	new Response(body, { status: 404 })
export const HttpMethodNotAllowed = (
	allowedMethods: string[],
	body: BodyInit = "405",
) =>
	new Response(body, {
		status: 405,
		headers: {
			Allow: allowedMethods.join(", "),
		},
	})
export const HttpUnsupportedMediaType = (body: BodyInit = "415") =>
	new Response(body, { status: 415 })

/// Server error

export const HttpInternalServerError = (body: BodyInit = "500") =>
	new Response(body, { status: 500 })
