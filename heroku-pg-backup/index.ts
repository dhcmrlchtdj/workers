import { Rollbar } from '../_common/rollbar'
import { encode } from '../_common/base64'
import { createHash } from '../_common/crypto'

// from worker environment
declare const ROLLBAR_KEY: string
declare const PG_BACKUP_HEROKU_APP: string
declare const PG_BACKUP_HEROKU_TOKEN: string
declare const PG_BACKUP_B2_KEY_ID: string
declare const PG_BACKUP_B2_KEY: string
declare const PG_BACKUP_B2_BUCKET_ID: string

const rollbar = new Rollbar(ROLLBAR_KEY, 'heroku-pg-backup')

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

async function backup(_event: ScheduledEvent): Promise<void> {
    const file = await fetchBackup()
    if (file === null) return
    await uploadToB2(file)
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
                authorization: 'Basic ' + encode(':' + PG_BACKUP_HEROKU_TOKEN),
            },
        })
        await checkResp(resp)
        return resp.json()
    }

    const host = 'postgres-starter-api.heroku.com'
    const backups: HerokuBackup[] = await herokuFetch(
        'GET',
        `https://${host}/client/v11/apps/${PG_BACKUP_HEROKU_APP}/transfers`,
    )
    const last = backups
        .sort((a, b) => b.num - a.num)
        .find((x) => x.succeeded && x.to_type === 'gof3r')
    if (!last) return null

    const download: HerokuDownload = await herokuFetch(
        'POST',
        `https://${host}/client/v11/apps/${PG_BACKUP_HEROKU_APP}/transfers/${last.num}/actions/public-url`,
    )
    const created_at = last.created_at
        .replace(' +0000', '')
        .replace(' ', '_')
        .replace(/:/g, '')

    const resp = await fetch(download.url)
    await checkResp(resp)
    const content = await resp.arrayBuffer()

    return { content, name: `${created_at}_rev${last.num}.dump` }
}

async function uploadToB2(file: { content: ArrayBuffer; name: string }) {
    let resp: Response

    const ba = encode(PG_BACKUP_B2_KEY_ID + ':' + PG_BACKUP_B2_KEY)
    resp = await fetch(
        'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
        {
            headers: {
                authorization: 'Basic ' + ba,
            },
        },
    )
    await checkResp(resp)
    const b2AuthorizeAccount: B2AuthorizeAccount = await resp.json()

    resp = await fetch(
        b2AuthorizeAccount.apiUrl + '/b2api/v2/b2_get_upload_url',
        {
            method: 'POST',
            headers: { authorization: b2AuthorizeAccount.authorizationToken },
            body: JSON.stringify({ bucketId: PG_BACKUP_B2_BUCKET_ID }),
        },
    )
    await checkResp(resp)
    const b2GetUploadUrl: B2GetUploadUrl = await resp.json()

    const hash = createHash('SHA-1')
    hash.update(file.content)
    resp = await fetch(b2GetUploadUrl.uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: b2GetUploadUrl.authorizationToken,
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(file.content.byteLength),
            'X-Bz-File-Name': file.name,
            'X-Bz-Content-Sha1': await hash.digest('hex'),
        },
        body: file.content,
    })
    await checkResp(resp)
}

async function checkResp(resp: Response) {
    if (resp.status !== 200) {
        const text = await resp.text()
        throw new Error(resp.statusText + '\n' + text)
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

type B2AuthorizeAccount = {
    absoluteMinimumPartSize: number
    recommendedPartSize: number
    allowed: {
        capabilities: string[]
        bucketId: string | null
        bucketName: string | null
        namePrefix: null
    }
    accountId: string
    apiUrl: string
    authorizationToken: string
    downloadUrl: string
}

type B2GetUploadUrl = {
    authorizationToken: string
    bucketId: string
    uploadUrl: string
}
