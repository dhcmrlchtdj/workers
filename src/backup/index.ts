import { format } from "../_common/format-date"
import { listenFetch } from "../_common/listen"
import { getBA } from "../_common/basic_auth"

// from worker environment
declare const ROLLBAR_KEY: string
declare const BACKUP_PASS_BEANCOUNT: string
declare const R2Backup: R2Bucket

///

listenFetch("backup", ROLLBAR_KEY, backup)

///

async function backup(event: FetchEvent): Promise<Response> {
    const req = event.request
    if (req.method.toUpperCase() !== "POST")
        throw new Error("405 Method Not Allowed")
    const ct = req.headers.get("content-type")
    if (!ct || !ct.startsWith("multipart/form-data; boundary"))
        throw new Error("415 Unsupported Media Type")
    const [user, pass] = getBA(req.headers.get("authorization"))

    if (user === "beancount" && pass === BACKUP_PASS_BEANCOUNT) {
        const body = await req.formData()
        const file = body.get("file")
        if (!(file instanceof File)) {
            throw new Error("`file` is not a file")
        }
        const date = format(new Date(), "YYYYMMDD_hhmmss")
        await R2Backup.put(`beancount-${date}.tar.zst.age`, file.stream(), {
            httpMetadata: { contentType: "application/octet-stream" },
        })
    }
    return new Response("ok")
}
