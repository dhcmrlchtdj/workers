import { WorkerRouter } from '../_common/router'
import { webhook } from './webhook'
import { initFetchHandle } from '../_common/init_handle'

// from worker environment
declare const BCC_WEBHOOK_PATH: string
declare const BCC_BOT_TOKEN: string
declare const ROLLBAR_KEY: string
declare const DB_API: string
declare const DB_TOKEN: string

///

const router = new WorkerRouter().post(
    `/telegram/bcc/${BCC_WEBHOOK_PATH}`,
    (event) => webhook(event.request),
)

initFetchHandle('bcc', ROLLBAR_KEY, (e) => router.route(e))
