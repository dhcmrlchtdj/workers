import { Telegram } from "../_common/service/telegram"
import { getBA } from "../_common/basic_auth"
import { listenFetch } from "../_common/listen"

declare const IP: KVNamespace

// from worker environment
declare const ROLLBAR_KEY: string
declare const ROLLBAR_TG_BOT_TOKEN: string
declare const ROLLBAR_TG_CHAT_ID: string
declare const IP_PASS_NUC: string

listenFetch("current-ip", ROLLBAR_KEY, handle)

async function handle(event: FetchEvent): Promise<Response> {
    const req = event.request

    const currIp = req.headers.get("CF-Connecting-IP")
    if (currIp === null) {
        throw new Error("CF-Connecting-IP is empty")
    }

    const [user, pass] = getBA(req.headers.get("authorization"))
    if (user === "nuc" && pass === IP_PASS_NUC) {
        await saveCurrentIp("nuc", currIp)
    }

    return new Response("ok")
}

async function saveCurrentIp(machine: string, currIp: string) {
    const prevIp = await IP.get(machine)
    if (prevIp !== currIp) {
        await IP.put(machine, currIp)
        const telegram = new Telegram(ROLLBAR_TG_BOT_TOKEN)
        await telegram.send("sendMessage", {
            parse_mode: "HTML",
            chat_id: Number(ROLLBAR_TG_CHAT_ID),
            text: `IP changed<br><pre>${machine} => ${currIp}</pre>`,
        })
    }
}
