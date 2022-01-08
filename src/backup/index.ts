import { BackBlaze } from "../_common/service/backblaze"
import { format } from "../_common/format-date"
import { getBA } from "../_common/basic_auth"
import { Rollbar } from "../_common/service/rollbar"

// from worker environment
type ENV = {
    ROLLBAR_KEY: string
    BACKUP_PASS_BEANCOUNT: string
    BACKUP_B2_KEY_ID: string
    BACKUP_B2_KEY: string
    BACKUP_B2_REGION: string
    BACKUP_B2_BUCKET: string
}

///

const worker: ExportedHandler<ENV> = {
    async fetch(req, env, ctx) {
        const monitor = new Rollbar(env.ROLLBAR_KEY, "backup")
        try {
            return await handler(req, env)
        } catch (err) {
            ctx.waitUntil(monitor.error(err as Error, req))
            return new Response("ok")
        }
    },
}

export default worker

///

async function handler(req: Request, env: ENV): Promise<Response> {
    const b2 = new BackBlaze(
        env.BACKUP_B2_KEY_ID,
        env.BACKUP_B2_KEY,
        env.BACKUP_B2_REGION,
    )

    if (req.method.toUpperCase() !== "POST")
        throw new Error("405 Method Not Allowed")
    const ct = req.headers.get("content-type")
    if (!ct || !ct.startsWith("multipart/form-data; boundary"))
        throw new Error("415 Unsupported Media Type")
    const [user, pass] = getBA(req.headers.get("authorization"))

    if (user === "beancount" && pass === env.BACKUP_PASS_BEANCOUNT) {
        const body = await req.formData()
        const file = body.get("file")
        if (!(file instanceof File)) {
            throw new Error("`file` is not a file")
        }
        const buf = await file.arrayBuffer()
        const date = format(new Date(), "YYYYMMDD_hhmmss")
        await b2.putObject(
            env.BACKUP_B2_BUCKET,
            `beancount/${date}.tar.zst.age`,
            buf,
            "application/octet-stream",
        )
    }
    return new Response("ok")
}
