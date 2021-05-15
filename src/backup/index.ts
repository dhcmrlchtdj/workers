import { BackBlaze } from '../_common/service/backblaze'
import { decode } from '../_common/base64'
import { format } from '../_common/format-date'
import { fromStr } from '../_common/array_buffer'
import { listenFetch } from '../_common/listen'

// from worker environment
declare const ROLLBAR_KEY: string
declare const BACKUP_PASS_BEANCOUNT: string
declare const BACKUP_B2_KEY_ID: string
declare const BACKUP_B2_KEY: string
declare const BACKUP_B2_REGION: string
declare const BACKUP_B2_BUCKET: string

///

listenFetch('backup', ROLLBAR_KEY, backup)

///

const b2 = new BackBlaze(BACKUP_B2_KEY_ID, BACKUP_B2_KEY, BACKUP_B2_REGION)

async function backup(event: FetchEvent): Promise<Response> {
    const req = event.request
    if (req.method.toUpperCase() !== 'POST')
        throw new Error('405 Method Not Allowed')
    const ct = req.headers.get('content-type')
    if (!ct || !ct.startsWith('multipart/form-data; boundary'))
        throw new Error('415 Unsupported Media Type')
    const [user, pass] = getBA(req.headers.get('authorization'))

    if (user === 'beancount' && pass === BACKUP_PASS_BEANCOUNT) {
        const body = await req.formData()
        // XXX: cloudflare BUG, it should be File
        const file = body.get('file') as string
        if (typeof file !== 'string') throw new Error('expect file')
        const buf = fromStr(file)
        const date = format(new Date(), 'YYYYMMDD_hhmmss', true)
        await b2.putObject(
            BACKUP_B2_BUCKET,
            `beancount/${date}.tar.zst.asc`,
            buf,
            'application/octet-stream',
        )
    }
    return new Response('ok')
}

function getBA(auth: string | null): [string, string] {
    if (!auth) throw new Error('missing authorization')
    const match = /\s*basic\s*(\S+)\s*/i.exec(auth)
    if (!match) throw new Error('expect BasicAuth')
    const user_pass = /([^:]+):(\S+)/.exec(decode(match[1]!))
    if (!user_pass) throw new Error('expect user:pass')
    return [user_pass[1]!, user_pass[2]!]
}
