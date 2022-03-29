import { WorkerRouter } from "../_common/router"
import { routeFetch } from "../_common/listen"
import { webhook } from "./webhook"

// from worker environment
declare const TIMESLAYER_WEBHOOK_PATH: string
declare const TIMESLAYER_BOT_TOKEN: string
declare const ROLLBAR_KEY: string
declare const DB_API: string
declare const DB_TOKEN: string

///

const router = new WorkerRouter()
router.post(`/telegram/timeslayer/${TIMESLAYER_WEBHOOK_PATH}`, webhook)

///

routeFetch("timeslayer", ROLLBAR_KEY, (e) => router.route(e))

///

// score - show score
// history - show history
// delete - delete score
