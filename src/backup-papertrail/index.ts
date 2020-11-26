// https://documentation.solarwinds.com/en/Success_Center/papertrail/Content/kb/how-it-works/permanent-log-archives.htm

import { BackBlaze } from '../_common/service/backblaze'
import { format } from '../_common/format-date'
import { GET } from '../_common/feccan'
import { initScheduleHandle } from '../_common/init_handle'

// from worker environment
declare const ROLLBAR_KEY: string
declare const BACKUP_B2_KEY_ID: string
declare const BACKUP_B2_KEY: string
declare const BACKUP_B2_REGION: string
declare const BACKUP_B2_BUCKET: string
declare const BACKUP_PAPERTRAIL_TOKEN: string

///

initScheduleHandle('backup-papertrail', ROLLBAR_KEY, backup)

///

const b2 = new BackBlaze(BACKUP_B2_KEY_ID, BACKUP_B2_KEY, BACKUP_B2_REGION)

async function backup(_event: ScheduledEvent): Promise<void> {
    const yestoday = new Date()
    yestoday.setUTCDate(yestoday.getUTCDate() - 1)
    const prefix = format(yestoday, 'YYYY-MM-DD', true)

    const archives: archive[] = await GET(
        'https://papertrailapp.com/api/v1/archives.json',
        { 'X-Papertrail-Token': BACKUP_PAPERTRAIL_TOKEN },
    ).then((r) => r.json())

    const tasks = archives
        .filter((x) => x.filename.startsWith(prefix))
        .map(async (x) => {
            const file = await GET(x._links.download.href, {
                'X-Papertrail-Token': BACKUP_PAPERTRAIL_TOKEN,
            }).then((r) => r.arrayBuffer())
            await b2.putObject(
                BACKUP_B2_BUCKET,
                x.filename,
                file,
                'application/gzip',
            )
        })
    await Promise.all(tasks)
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
