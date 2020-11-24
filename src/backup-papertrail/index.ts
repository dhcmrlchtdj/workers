import { BackBlaze } from '../_common/service/backblaze'
import { Rollbar } from '../_common/service/rollbar'
import { check } from '../_common/check_response'
import { format } from '../_common/format-date'

// from worker environment
declare const ROLLBAR_KEY: string
declare const BACKUP_B2_KEY_ID: string
declare const BACKUP_B2_KEY: string
declare const BACKUP_B2_REGION: string
declare const BACKUP_B2_BUCKET: string
declare const BACKUP_PAPERTRAIL_TOKEN: string

const rollbar = new Rollbar(ROLLBAR_KEY, 'backup-papertrail')

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
    // https://documentation.solarwinds.com/en/Success_Center/papertrail/Content/kb/how-it-works/permanent-log-archives.htm
    // It takes approximately 6-7 hours for logs to be available in the archive.
    const prev = new Date()
    prev.setHours(prev.getHours() - 12)
    const date = format(prev, 'YYYY-MM-DD-hh', true)
    const url = `https://papertrailapp.com/api/v1/archives/${date}/download`
    const resp = await fetch(url, {
        headers: { 'X-Papertrail-Token': BACKUP_PAPERTRAIL_TOKEN },
    })
    await check(resp)
    const file = await resp.arrayBuffer()

    await b2.putObject(
        BACKUP_B2_BUCKET,
        `papertrail/${date}.tsv.gz`,
        file,
        'application/gzip',
    )
}
