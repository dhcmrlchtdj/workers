import { format } from "../_common/format-date"
import { getBA } from "../_common/basic_auth"
import { Rollbar } from "../_common/service/rollbar"

type ENV = {
    ROLLBAR_KEY: string
    BACKUP_PASS_BEANCOUNT: string
    R2Backup: R2Bucket
}
const worker: ExportedHandler<ENV> = {
    async fetch(request: Request, env: ENV, ctx: ExecutionContext) {
        const monitor = new Rollbar(env.ROLLBAR_KEY, "backup")
        try {
            const resp = await backup(request, env)
            return resp
        } catch (err) {
            ctx.waitUntil(monitor.error(err as Error, request))
            return new Response("ok")
        }
    },
}
export default worker

async function backup(req: Request, env: ENV): Promise<Response> {
    if (req.method.toUpperCase() !== "POST")
        throw new Error("405 Method Not Allowed")
    const ct = req.headers.get("content-type")
    if (!ct || !ct.startsWith("multipart/form-data; boundary"))
        throw new Error("415 Unsupported Media Type")
    const [user, pass] = getBA(req.headers.get("authorization"))

    if (user === "beancount") {
        if (pass === env.BACKUP_PASS_BEANCOUNT) {
            const body = await req.formData()
            const file = body.get("file")
            if (!(file instanceof File)) {
                throw new Error("`file` is not a file")
            }
            const buf = await file.arrayBuffer()
            const date = format(new Date(), "YYYYMMDD_hhmmss")
            await env.R2Backup.put(`beancount/${date}.tar.zst.age`, buf, {
                httpMetadata: { contentType: "application/octet-stream" },
            })
            return new Response("ok")
        } else {
            return new Response("invalid password")
        }
    } else {
        return new Response("invalid user")
    }
}
