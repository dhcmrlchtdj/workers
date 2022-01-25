import { Telegram } from "../_common/service/telegram"
import { listenFetch } from "../_common/listen"

declare const IP: KVNamespace

// from worker environment
declare const ROLLBAR_KEY: string
declare const ROLLBAR_TG_BOT_TOKEN: string
declare const ROLLBAR_TG_CHAT_ID: string

listenFetch("current-ip", ROLLBAR_KEY, handle)

const telegram = new Telegram(ROLLBAR_TG_BOT_TOKEN)

async function handle(event: FetchEvent): Promise<Response> {
    const req = event.request
    const currIp = req.headers.get("CF-Connecting-IP")
    if (currIp === null) {
        throw new Error("CF-Connecting-IP is empty")
    }

    const prevIp = await IP.get("current")
    if (prevIp === null) {
        saveCurrentIp(currIp)
    } else {
        if (prevIp !== currIp) {
            saveCurrentIp(currIp)
        }
    }

    return new Response("ok")
}

async function saveCurrentIp(ip: string) {
    await IP.put("current", ip)

    await telegram.send("sendMessage", {
        parse_mode: "HTML",
        chat_id: Number(ROLLBAR_TG_CHAT_ID),
        text: `IP changed to ${ip}`,
    })
}
