import { Rollbar } from '../../_common/rollbar'
import { InfluxClient, BASE_AWS_OREGON, Line } from '../../_common/influx'
import { WorkerRouter } from '../../_common/router'
import { parse, Logplex } from './logplex'
import { transform } from './logplex2influx'

// from worker environment
declare const FBOX_LOGPLEX_WEBHOOK_PATH: string // openssl rand -hex 16
declare const FBOX_LOGPLEX_DRAIN_TOKEN: string
declare const FBOX_INFLUX_TOKEN: string
declare const ROLLBAR_KEY: string

const rollbar = new Rollbar(ROLLBAR_KEY, 'logplex')
const influx = new InfluxClient(
    FBOX_INFLUX_TOKEN,
    BASE_AWS_OREGON,
    'h11',
    'feedbox',
    'ms',
)

const router = new WorkerRouter()
router.post(`/logplex/${FBOX_LOGPLEX_WEBHOOK_PATH}`, async (event) => {
    const req = event.request
    if (req.headers.get('content-type') !== 'application/logplex-1') {
        throw new Error('415 Unsupported Media Type')
    }
    if (req.headers.get('logplex-drain-token') !== FBOX_LOGPLEX_DRAIN_TOKEN) {
        throw new Error('403 Forbidden')
    }

    const text = await req.text()
    const logs = text
        .split('\n')
        .map(parse)
        .filter((x): x is Logplex => x !== null)
        .map(transform)
        .filter((x): x is Line => x !== null)
        .map((x) => x.toString())
        .join('\n')
    if (logs.length > 0) {
        const sendToInflux = influx
            .write(logs)
            .catch((err) => rollbar.err(req, err))
        event.waitUntil(sendToInflux)
    }
    return new Response('ok', { status: 200 })
})

const handle = async (event: FetchEvent) => {
    try {
        const resp = await router.route(event)
        return resp
    } catch (err) {
        event.waitUntil(rollbar.err(event.request, err))
        const msg = `${err}\n${err.stack}`
        return new Response(msg, { status: 200 })
    }
}

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})
