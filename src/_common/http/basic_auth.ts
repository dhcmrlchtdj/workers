import { fromBase64 } from "../base64.js"
import { HttpBadRequest, HttpUnauthorized } from "./status.js"

// https://developers.cloudflare.com/workers/examples/basic-auth/

export function getBA(auth: string | null): { user: string; pass: string } {
	if (!auth) {
		throw HttpUnauthorized(["Basic"])
	}

	const encoded = auth.slice(6)
	if (!(auth.startsWith("Basic ") && encoded)) {
		throw HttpBadRequest("malformed authorization header")
	}

	const decoded = fromBase64(encoded)
	const index = decoded.indexOf(":")
	// eslint-disable-next-line no-control-regex
	if (index === -1 || /[\x00-\x1F\x7F]/.test(decoded)) {
		throw HttpBadRequest("invalid authorization value")
	}

	return {
		user: decoded.slice(0, index),
		pass: decoded.slice(index + 1),
	}
}

export function validate(req: Request, username: string, password: string) {
	const { user, pass } = getBA(req.headers.get("authorization"))
	if (username !== user || password !== pass) throw new Error("unauthorized")
}
