import type { Context } from "../_common/router"
import type { Update, Message } from "telegram-typings"
import { Telegram } from "../_common/service/telegram"
import * as query from "./query"

declare const TIMESLAYER_BOT_TOKEN: string
export const telegram = new Telegram(TIMESLAYER_BOT_TOKEN, "timeslayer_bot")

const handleCommand = async (
    msg: Message,
    command: { cmd: string; arg: string },
) => {
    if (command.cmd === "/score") {
        const score = await query.getScore(msg.chat.id)
        await telegram.send("sendMessage", {
            chat_id: msg.chat.id,
            text: `${score}`,
        })
    } else if (command.cmd === "/history") {
        const arg = Number(command.arg)
        const limit = Number.isInteger(arg) ? arg : 10
        const history = await query.getHistory(msg.chat.id, limit)
        await telegram.send("sendMessage", {
            chat_id: msg.chat.id,
            text: JSON.stringify(history) || "empty",
        })
    } else {
        // unknown command
    }
}

const handleMsg = async (msg: Message | undefined) => {
    if (!msg || !msg.text) return

    const command = telegram.extractCommand(msg)
    if (command) {
        await handleCommand(msg, command)
        return
    }

    const match = /^\s*([+-]\d+)\s(\S.*)$/.exec(msg.text)
    if (match) {
        const score = match[1]!
        const reason = match[2]!.trim()
        await query.addScore(msg.chat.id, Number(score), reason)
        await telegram.send("sendMessage", {
            chat_id: msg.chat.id,
            text: "recorded",
        })
    } else {
        await telegram.send("sendMessage", {
            chat_id: msg.chat.id,
            text: "unknown directive",
        })
    }
}

export const webhook = async ({
    event,
    monitor,
}: Context): Promise<Response> => {
    const req = event.request
    const handle = (m: Message | undefined) =>
        event.waitUntil(handleMsg(m).catch((e) => monitor.error(e, req)))

    const payload: Update = await req.json()
    handle(payload.message)
    handle(payload.edited_message)
    handle(payload.channel_post)
    handle(payload.edited_channel_post)

    return new Response("ok")
}
