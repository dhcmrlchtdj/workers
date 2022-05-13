import { format } from "../_common/format-date"
import { getBA } from "../_common/basic_auth"
import { createWorker } from "../_common/listen"

type ENV = {
    ROLLBAR_KEY: string
    BACKUP_PASS_BEANCOUNT: string
    R2Backup: R2Bucket
}

const worker = createWorker("backup", async (req: Request, env: ENV) => {
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
            throw new Error(`beancount | invalid password | '${pass}'`)
        }
    } else {
        throw new Error(`invalid user | '${user}'`)
    }
})

export default worker
