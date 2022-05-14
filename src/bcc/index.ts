import { createWorkerByRouter } from "../_common/listen"
import type { Env } from "./types"
import { webhook } from "./webhook"

const worker = createWorkerByRouter<Env>("bcc", async (router, _req, env) => {
    router.post(`/telegram/bcc/${env.BCC_WEBHOOK_PATH}`, webhook)
})

export default worker

// whoami - WHO AM I
// list - list all #HASHTAG
// update - update #HASHTAG list
// remove - [#HASHTAG] remove #HASHTAG
