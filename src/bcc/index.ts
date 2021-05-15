import { WorkerRouter } from '../_common/router'
import { routeFetch } from '../_common/listen'
import { webhook } from './webhook'

// from worker environment
declare const BCC_WEBHOOK_PATH: string
declare const BCC_BOT_TOKEN: string
declare const ROLLBAR_KEY: string
declare const DB_API: string
declare const DB_TOKEN: string

///

const router = new WorkerRouter().post(
    `/telegram/bcc/${BCC_WEBHOOK_PATH}`,
    webhook,
)

///

routeFetch('bcc', ROLLBAR_KEY, router.route)
