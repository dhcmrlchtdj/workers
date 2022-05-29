// https://documentation.solarwinds.com/en/Success_Center/papertrail/Content/kb/how-it-works/permanent-log-archives.htm

import { GET } from "../_common/feccan.js"
import { format } from "../_common/format-date.js"
import { createScheduler } from "../_common/listen.js"

type ENV = {
    ROLLBAR_KEY: string
    R2Backup: R2Bucket
    BACKUP_PAPERTRAIL_TOKEN: string
}

const worker = createScheduler(
    "backup-papertrail",
    async (_controller, env: ENV) => {
        const yesterday = new Date()
        yesterday.setUTCDate(yesterday.getUTCDate() - 1)
        const date = format(yesterday, "YYYY-MM-DD-hh")

        const file = await GET(
            `https://papertrailapp.com/api/v1/archives/${date}/download`,
            { "X-Papertrail-Token": env.BACKUP_PAPERTRAIL_TOKEN },
        )
        if (file.body === null) return

        await env.R2Backup.put(`log/papertrail/${date}.tsv.gz`, file.body, {
            httpMetadata: { contentType: "application/gzip" },
        })
    },
)

export default worker
