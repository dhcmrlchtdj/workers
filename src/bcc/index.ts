import { createWorkerByRouter } from "../_common/listen"
import type { Env } from "./types"
import { webhook } from "./webhook"

const worker = createWorkerByRouter<Env>(
    "bcc",
    async ({ router, env }) => {
        router.post(`/telegram/bcc/${env.BCC_WEBHOOK_PATH}`, webhook)
    },
    true,
)

export default worker

// whoami - WHO AM I
// list - list all #HASHTAG
// update - update #HASHTAG list
// remove - [#HASHTAG] remove #HASHTAG
