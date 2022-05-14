export const HttpOk = (body: BodyInit = "OK") =>
    new Response(body, {
        status: 200,
        statusText: "OK",
    })
export const HttpCreated = (body: BodyInit = "Created") =>
    new Response(body, {
        status: 201,
        statusText: "Created",
    })

// client error

export const HttpBadRequest = (body: BodyInit = "Bad Request") =>
    new Response(body, {
        status: 400,
        statusText: "Bad Request",
    })
export const HttpUnauthorized = (
    auth: string[],
    body: BodyInit = "Unauthorized",
) =>
    new Response(body, {
        status: 401,
        statusText: "Unauthorized",
        headers: {
            "WWW-Authenticate": auth.join(", "),
        },
    })
export const HttpForbidden = (body: BodyInit = "Forbidden") =>
    new Response(body, {
        status: 403,
        statusText: "Forbidden",
    })
export const HttpNotFound = (body: BodyInit = "Not Found") =>
    new Response(body, {
        status: 404,
        statusText: "Not Found",
    })
export const HttpMethodNotAllowed = (
    allowedMethods: ("HEAD" | "GET" | "POST" | "PUT" | "DELETE" | "OPTION")[],
    body: BodyInit = "Method Not Allowed",
) =>
    new Response(body, {
        status: 405,
        statusText: "Method Not Allowed",
        headers: {
            Allow: allowedMethods.join(", "),
        },
    })
export const HttpUnsupportedMediaType = (
    body: BodyInit = "Unsupported Media Type",
) =>
    new Response(body, {
        status: 415,
        statusText: "Unsupported Media Type",
    })

/// Server error

export const HttpInternalServerError = (
    body: BodyInit = "Internal Server Error",
) =>
    new Response(body, {
        status: 500,
        statusText: "Internal Server Error",
    })
