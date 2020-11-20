import { Rollbar } from '../_common/rollbar'
import { BackBlaze } from '../_common/backblaze'
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
    // curl  -L -H "v: YOUR-HTTP-API-KEY" \
    const date = format(new Date(), 'YYYY-MM-DD-hh', true)
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
