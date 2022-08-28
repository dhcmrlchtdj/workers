import { createWorkerByRouter } from "../_common/listen.js"
import type { Env } from "./types.js"
import { webhook } from "./webhook.js"

const worker = createWorkerByRouter<Env>(
	"bcc",
	({ router, env }) => {
		router.post(`/telegram/bcc/${env.BCC_WEBHOOK_PATH}`, webhook)
	},
	true,
)

export default worker

// whoami - WHO AM I
// list - list all #HASHTAG
// update - update #HASHTAG list
// remove - [#HASHTAG] remove #HASHTAG
