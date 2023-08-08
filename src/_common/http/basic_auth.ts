import { fromBase64 } from "../base64.js"
import { HttpBadRequest, HttpUnauthorized } from "./status.js"

// https://developers.cloudflare.com/workers/examples/basic-auth/

export function getBA(auth: string | null): {
	username: string
	password: string
} {
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
		username: decoded.slice(0, index),
		password: decoded.slice(index + 1),
	}
}
