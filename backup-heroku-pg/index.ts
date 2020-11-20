import { Rollbar } from '../_common/rollbar'
import { encode } from '../_common/base64'
import { BackBlaze } from '../_common/backblaze'
import { check } from '../_common/check_response'

// from worker environment
declare const ROLLBAR_KEY: string
declare const BACKUP_B2_KEY_ID: string
declare const BACKUP_B2_KEY: string
declare const BACKUP_B2_REGION: string
declare const BACKUP_B2_BUCKET: string
declare const BACKUP_HEROKU_PG_APP: string
declare const BACKUP_HEROKU_PG_TOKEN: string

const rollbar = new Rollbar(ROLLBAR_KEY, 'backup-heroku-pg')

addEventListener('scheduled', (event) => {
    event.waitUntil(handle(event))
})

async function handle(event: ScheduledEvent) {
    try {
        await backup(event)
    } catch (err) {
        event.waitUntil(rollbar.error(err))
    }
}

///

const b2 = new BackBlaze(BACKUP_B2_KEY_ID, BACKUP_B2_KEY, BACKUP_B2_REGION)

async function backup(_event: ScheduledEvent): Promise<void> {
    const file = await fetchBackup()
    if (file === null) return
    await b2.putObject(
        BACKUP_B2_BUCKET,
        file.name,
        file.content,
        'application/octet-stream',
    )
}

async function fetchBackup(): Promise<{
    content: ArrayBuffer
    name: string
} | null> {
    // https://github.com/heroku/cli/blob/v7.47.0/packages/pg-v5/commands/backups/url.js
    const herokuFetch = async (method: 'GET' | 'POST', url: string) => {
        const resp = await fetch(url, {
            method,
            headers: {
                accept: 'application/json',
                authorization: 'Basic ' + encode(':' + BACKUP_HEROKU_PG_TOKEN),
            },
        })
        await check(resp)
        return resp.json()
    }

    const host = 'postgres-starter-api.heroku.com'
    const backups: HerokuBackup[] = await herokuFetch(
        'GET',
        `https://${host}/client/v11/apps/${BACKUP_HEROKU_PG_APP}/transfers`,
    )
    const last = backups
        .sort((a, b) => b.num - a.num)
        .find((x) => x.succeeded && x.to_type === 'gof3r')
    if (!last) return null

    const download: HerokuDownload = await herokuFetch(
        'POST',
        `https://${host}/client/v11/apps/${BACKUP_HEROKU_PG_APP}/transfers/${last.num}/actions/public-url`,
    )
    const created_at = last.created_at
        .replace(' +0000', '')
        .replace(' ', '_')
        .replace(/:/g, '')

    const resp = await fetch(download.url)
    await check(resp)
    const content = await resp.arrayBuffer()

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
    to_name: string | 'SCHEDULED BACKUP' | 'BACKUP'
    to_type: string | 'gof3r'
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
