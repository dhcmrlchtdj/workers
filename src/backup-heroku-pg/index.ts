import { BackBlaze } from "../_common/service/backblaze"
import { Rollbar } from "../_common/service/rollbar"
import { GET, POST } from "../_common/feccan"
import { encode } from "../_common/base64"

// from worker environment
type ENV = {
    ROLLBAR_KEY: string
    BACKUP_B2_KEY_ID: string
    BACKUP_B2_KEY: string
    BACKUP_B2_REGION: string
    BACKUP_B2_BUCKET: string
    BACKUP_HEROKU_PG_APP: string
    BACKUP_HEROKU_PG_TOKEN: string
}

///

const worker: ExportedHandler<ENV> = {
    async scheduled(_event, env, ctx) {
        const monitor = new Rollbar(env.ROLLBAR_KEY, "backup-heroku-pg")
        try {
            await handler(env)
        } catch (err) {
            ctx.waitUntil(monitor.error(err as Error))
        }
    },
}

export default worker

///

async function handler(env: ENV) {
    const file = await fetchBackup(env)
    if (file === null) return

    const b2 = new BackBlaze(
        env.BACKUP_B2_KEY_ID,
        env.BACKUP_B2_KEY,
        env.BACKUP_B2_REGION,
    )
    await b2.putObject(
        env.BACKUP_B2_BUCKET,
        file.name,
        file.content,
        "application/octet-stream",
    )
}

async function fetchBackup(env: ENV): Promise<{
    content: ArrayBuffer
    name: string
} | null> {
    // https://github.com/heroku/cli/blob/v7.47.0/packages/pg-v5/commands/backups/url.js
    const headers = {
        accept: "application/json",
        authorization: "Basic " + encode(":" + env.BACKUP_HEROKU_PG_TOKEN),
    }

    const host = "postgres-starter-api.heroku.com"
    const backups: HerokuBackup[] = await GET(
        `https://${host}/client/v11/apps/${env.BACKUP_HEROKU_PG_APP}/transfers`,
        headers,
    ).then((r) => r.json())
    const last = backups
        .sort((a, b) => b.num - a.num)
        .find((x) => x.succeeded && x.to_type === "gof3r")
    if (!last) return null

    const download: HerokuDownload = await POST(
        `https://${host}/client/v11/apps/${env.BACKUP_HEROKU_PG_APP}/transfers/${last.num}/actions/public-url`,
        null,
        headers,
    ).then((r) => r.json())
    const created_at = last.created_at
        .replace(" +0000", "")
        .replace(" ", "_")
        .replace(/:/g, "")

    const content = await GET(download.url).then((r) => r.arrayBuffer())

    return {
        content,
        name: `heroku-pg-backup/${created_at}_rev${last.num}.dump`,
    }
}

///

type HerokuBackup = {
    uuid: string
    num: number
    from_name: string
    from_type: string
    from_url: string
    to_name: string | "SCHEDULED BACKUP" | "BACKUP"
    to_type: string | "gof3r"
    to_url: string
    options: {}
    source_bytes: number
    processed_bytes: number
    succeeded: boolean
    warnings: number
    created_at: string
    started_at: string | null
    canceled_at: string | null
    updated_at: string | null
    finished_at: string | null
    deleted_at: string | null
    purged_at: string | null
    num_keep: number
    schedule?: {
        uuid: string
    }
}

type HerokuDownload = {
    expires_at: string
    url: string
}
