// https://documentation.solarwinds.com/en/Success_Center/papertrail/Content/kb/how-it-works/permanent-log-archives.htm

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
    const yestoday = new Date()
    yestoday.setUTCDate(yestoday.getUTCDate() - 1)
    const prefix = format(yestoday, 'YYYY-MM-DD', true)

    const archives = await getArchives()
    const tasks = archives
        .filter((x) => x.filename.startsWith(prefix))
        .map(async (x) => {
            const resp = await fetch(x._links.download.href, {
                headers: { 'X-Papertrail-Token': BACKUP_PAPERTRAIL_TOKEN },
            })
            await check(resp)
            const file = await resp.arrayBuffer()
            await b2.putObject(
                BACKUP_B2_BUCKET,
                x.filename,
                file,
                'application/gzip',
            )
        })
    await Promise.all(tasks)
}

async function getArchives(): Promise<archive[]> {
    const resp = await fetch('https://papertrailapp.com/api/v1/archives.json', {
        headers: { 'X-Papertrail-Token': BACKUP_PAPERTRAIL_TOKEN },
    })
    await check(resp)
    return resp.json()
}

///

type archive = {
    start: string
    end: string
    start_formatted: string
    duration_formatted: string
    filename: string
    filesize: string
    _links: {
        download: {
            href: string
        }
    }
}
