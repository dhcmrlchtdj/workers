import { getBA } from "../_common/http/basic_auth.js"
import { createWorker } from "../_common/listen.js"
import * as R from "../_common/http/response.js"
import {
	HttpInternalServerError,
	HttpUnauthorized,
} from "../_common/http/status.js"
import { MIME_TEXT } from "../_common/http/mime.js"
import { toBase64 } from "../_common/base64.js"

type ENV = {
	BA: KVNamespace
	R2apac: R2Bucket
}

type KVItem = { password: string; proxies: string }

///

const worker = createWorker("proxy-list", async (req: Request, env: ENV) => {
	const { user, pass } = getBA(req.headers.get("authorization"))
	const item = await env.BA.get<KVItem>("proxy:" + user, {
		type: "json",
		cacheTtl: 60 * 60, // 60min
	})
	if (item?.password === pass) {
		const p = await env.R2apac.get("proxy.txt")
		if (p === null) throw HttpInternalServerError("[r2] 404")
		const text = await p.text()
		const b64 = toBase64(text)
		const resp = R.build(R.body(b64), R.contentType(MIME_TEXT))
		return resp
	} else {
		throw HttpUnauthorized(["Basic"])
	}
})

export default worker
