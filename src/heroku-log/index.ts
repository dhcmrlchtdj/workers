import type { Line } from '../_common/service/influx'
import type { Logplex } from '../_common/logplex'
import { InfluxClient, BASE_AWS_OREGON } from '../_common/service/influx'
import { WorkerRouter } from '../_common/router'
import { parse } from '../_common/logplex'
import { routeFetch } from '../_common/listen'
import { transform } from './transformer'

///

// from worker environment
declare const ROLLBAR_KEY: string
declare const HEROKU_LOG_WEBHOOK_PATH: string // openssl rand -hex 16
declare const HEROKU_LOG_DRAIN_TOKEN: string
declare const HEROKU_LOG_INFLUX_TOKEN: string

///

const influx = new InfluxClient(
    HEROKU_LOG_INFLUX_TOKEN,
    BASE_AWS_OREGON,
    'h11',
    'feedbox',
    'ms',
)

const router = new WorkerRouter()
router.post(
    `/heroku-log/${HEROKU_LOG_WEBHOOK_PATH}`,
    async ({ event, monitor }) => {
        const req = event.request
        if (req.headers.get('content-type') !== 'application/logplex-1') {
            throw new Error('415 Unsupported Media Type')
        }
        if (req.headers.get('logplex-drain-token') !== HEROKU_LOG_DRAIN_TOKEN) {
            throw new Error('403 Forbidden')
        }

        const text = await req.text()
        const logs = text
            .split('\n')
            .map(parse)
            .filter((x): x is Logplex => x !== null)
            .map(transform)
            .filter((x): x is Line => x !== null)
            .map((x) => x.serialize())
            .join('\n')

        if (logs.length > 0) {
            const sendToInflux = influx
                .write(logs)
                .catch((err) => monitor.error(err, req))
            event.waitUntil(sendToInflux)
        }

        return new Response('ok', { status: 200 })
    },
)

///

routeFetch('heroku-log', ROLLBAR_KEY, router.route)
