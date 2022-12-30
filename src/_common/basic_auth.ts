import { decode } from "./base64.js"
import { HttpBadRequest, HttpUnauthorized } from "./http-response.js"

// https://developers.cloudflare.com/workers/examples/basic-auth/

export function getBA(auth: string | null): { user: string; pass: string } {
	if (!auth) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw HttpUnauthorized(["Basic"])
	}

	const [scheme, encoded] = auth.split(" ")
	if (scheme !== "Basic" || !encoded) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw HttpBadRequest("malformed authorization header")
	}

	const decoded = decode(encoded)
	const index = decoded.indexOf(":")
	// eslint-disable-next-line no-control-regex
	if (index === -1 || /[\x00-\x1F\x7F]/.test(decoded)) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw HttpBadRequest("invalid authorization value")
	}

	return {
		user: decoded.substring(0, index),
		pass: decoded.substring(index + 1),
	}
}

export function validate(req: Request, username: string, password: string) {
	const { user, pass } = getBA(req.headers.get("authorization"))
	if (username !== user || password !== pass) throw new Error("unauthorized")
}
