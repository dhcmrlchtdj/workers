import type { RouterContext } from "../_common/listen"
import { WorkerRouter } from "../_common/router"
import { createWorkerByRouter } from "../_common/listen"
import type { Env } from "./types"
import { webhook } from "./webhook"

const worker = createWorkerByRouter<Env>("bcc", async (env: Env) => {
    const router = new WorkerRouter<RouterContext<Env>>()
    router.post(`/telegram/bcc/${env.BCC_WEBHOOK_PATH}`, webhook)
    return router
})

export default worker

// whoami - WHO AM I
// list - list all #HASHTAG
// update - update #HASHTAG list
// remove - [#HASHTAG] remove #HASHTAG
