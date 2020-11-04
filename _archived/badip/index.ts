import { Rollbar } from '../../_common/rollbar'
import { WorkerRouter } from '../../_common/router'
import { FaunaClient } from '../../_common/fauna'
import { sortIP } from './sort-ip'

declare const FAUNA_KEY: string
declare const ROLLBAR_KEY: string

const fauna = new FaunaClient(FAUNA_KEY)
const rollbar = new Rollbar(ROLLBAR_KEY, 'badip')

const router = new WorkerRouter()
    .post('/badip/report', async (event) => {
        const req = event.request
        const payload = await req.json()
        const ip = payload.ip
        if (ip) {
            await fauna.execute('badip_add', ip)
            return new Response('created', { status: 201 })
        } else {
            return new Response('invalid payload', { status: 200 })
        }
    })
    .get('/badip/all', async (_event) => {
        const list = await fauna.execute<string[]>('badip_get_all')
        list.sort(sortIP)
        return new Response(JSON.stringify(list, null, 4), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
        })
    })
    .get('/badip/recent', async (event) => {
        const query = new URL(event.request.url).searchParams
        const days = Number(query.get('days') ?? 14)
        const list = await fauna.execute<string[]>('badip_get_recent', days)
        list.sort(sortIP)
        return new Response(JSON.stringify(list, null, 4), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
        })
    })

const handle = async (event: FetchEvent) => {
    try {
        const resp = await router.route(event)
        return resp
    } catch (err) {
        event.waitUntil(rollbar.error(err, event.request))
        const msg = `${err}\n${err.stack}`
        return new Response(msg, { status: 200 })
    }
}

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})
