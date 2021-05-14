import type { Logplex } from '../_common/logplex'
import { WorkerRouter } from '../_common/router'
import { listenFetch } from '../_common/listen'
import { parse } from '../_common/logplex'
import { transform } from './logplex_to_loki'
import type { LokiLog } from '../_common/service/loki'
import { Loki } from '../_common/service/loki'

///

// from worker environment
declare const ROLLBAR_KEY: string
declare const LOGPLEX_WEBHOOK_PATH: string // openssl rand -hex 16
declare const LOGPLEX_DRAIN_TOKEN: string
declare const LOKI_TOKEN: string

///

const router = new WorkerRouter()
router.post(`/heroku/logplex/${LOGPLEX_WEBHOOK_PATH}`, async (event) => {
    const req = event.request
    if (req.headers.get('content-type') !== 'application/logplex-1') {
        throw new Error('415 Unsupported Media Type')
    }
    if (req.headers.get('logplex-drain-token') !== LOGPLEX_DRAIN_TOKEN) {
        throw new Error('403 Forbidden')
    }

    const text = await req.text()
    const logs = text
        .split('\n')
        .map(parse)
        .filter((x): x is Logplex => x !== null)
        .map(transform)
        .filter((x): x is LokiLog => x !== null)

    if (logs.length > 0) {
        const sendToInflux = influx
            .write(logs)
            .catch((err) => rollbar.error(err, req))
        event.waitUntil(sendToInflux)
    }

    return new Response('ok', { status: 200 })
})

///

listenFetch('heroku-to-loki', ROLLBAR_KEY, router.route)
