import { decode } from "./base64"
import { HttpBadRequest, HttpUnauthorized } from "./http-response"

// https://developers.cloudflare.com/workers/examples/basic-auth/

export function getBA(auth: string | null): [string, string] {
    if (!auth) {
        throw HttpUnauthorized(["Basic"])
    }

    const [scheme, encoded] = auth.split(" ")
    if (scheme !== "Basic" || !encoded) {
        throw HttpBadRequest("malformed authorization header")
    }

    const decoded = decode(encoded)
    const index = decoded.indexOf(":")
    if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
        throw HttpBadRequest("invalid authorization value")
    }

    return [decoded.substring(0, index), decoded.substring(index + 1)]
}

export function validate(req: Request, user: string, pass: string) {
    const [u, p] = getBA(req.headers.get("authorization"))
    if (u !== user || p !== pass) throw new Error("unauthorized")
}
