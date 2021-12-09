import type { Context } from "../_common/router"
import type { Update, Message } from "telegram-typings"
import { Telegram } from "../_common/service/telegram"
import * as query from "./query"
import { format } from "../_common/format-date"

declare const TIMESLAYER_BOT_TOKEN: string
export const telegram = new Telegram(TIMESLAYER_BOT_TOKEN, "timeslayer_bot")

const formatScoreLog = (x: query.scoreLog): string => {
    const time = format(x.createdAt, "YYYY-MM-DD hh:mm")
    const score = x.score > 0 ? `+${x.score}` : x.score
    return `${time} | ${score} ${x.reason}`
}

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
        const limit = Number.isInteger(arg) && arg > 0 ? arg : 10
        const history = await query.getHistory(msg.chat.id, limit)
        const text = history.map(formatScoreLog).reverse().join("\n")
        await telegram.send("sendMessage", {
            chat_id: msg.chat.id,
            text: text || "not found",
        })
    } else if (command.cmd === "/delete") {
        let msgId = undefined
        if (msg.reply_to_message) {
            msgId = msg.reply_to_message.message_id
        } else if (/\d+/.test(command.arg)) {
            msgId = Number(command.arg)
        } else {
            await telegram.send("sendMessage", {
                chat_id: msg.chat.id,
                text: `not found`,
            })
            return
        }

        const deletedScore = await query.deleteScore(msg.chat.id, msgId)
        if (deletedScore === null) {
            await telegram.send("sendMessage", {
                chat_id: msg.chat.id,
                text: `not found`,
            })
        } else {
            await telegram.send("sendMessage", {
                chat_id: msg.chat.id,
                text: `deleted:\n${formatScoreLog(deletedScore)}`,
            })
        }
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

    const match = /^([+-]\d+)\s(.*)$/.exec(msg.text.trim())
    if (match) {
        const score = match[1]!
        const reason = match[2]!.trim()
        await query.addScore(msg.chat.id, msg.message_id, Number(score), reason)
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
