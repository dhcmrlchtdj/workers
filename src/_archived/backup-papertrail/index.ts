// https://documentation.solarwinds.com/en/Success_Center/papertrail/Content/kb/how-it-works/permanent-log-archives.htm

import { BackBlaze } from '../_common/service/backblaze'
import { format } from '../_common/format-date'
import { GET } from '../_common/feccan'
import { listenSchedule } from '../_common/listen'

// from worker environment
declare const ROLLBAR_KEY: string
declare const BACKUP_B2_KEY_ID: string
declare const BACKUP_B2_KEY: string
declare const BACKUP_B2_REGION: string
declare const BACKUP_B2_BUCKET: string
declare const BACKUP_PAPERTRAIL_TOKEN: string

///

listenSchedule('backup-papertrail', ROLLBAR_KEY, backup)

///

const b2 = new BackBlaze(BACKUP_B2_KEY_ID, BACKUP_B2_KEY, BACKUP_B2_REGION)

async function backup(_event: ScheduledEvent): Promise<void> {
    const yestoday = new Date()
    yestoday.setUTCDate(yestoday.getUTCDate() - 1)
    const date = format(yestoday, 'YYYY-MM-DD-hh', true)

    const file = await GET(
        `https://papertrailapp.com/api/v1/archives/${date}/download`,
        { 'X-Papertrail-Token': BACKUP_PAPERTRAIL_TOKEN },
    ).then((r) => r.arrayBuffer())

    await b2.putObject(
        BACKUP_B2_BUCKET,
        `papertrail/${date}.tsv.gz`,
        file,
        'application/gzip',
    )
}
