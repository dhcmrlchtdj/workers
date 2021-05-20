import { Update, Message } from "telegram-typings"
import { execute, telegram } from "./bot_command"
import type { Context } from "../_common/router"

const handleMsg = async (msg: Message | undefined) => {
    if (!msg || !msg.text || !msg.entities) return

    const command = telegram.extractCommand(msg)
    if (command !== undefined && command.cmd !== "/add") {
        await execute(command.cmd, command.arg, msg)
        return
    }

    const hashtags = msg.entities
        .filter((x) => x.type === "hashtag")
        .map((entity) => msg.text!.substr(entity.offset, entity.length))
    if (hashtags.length > 0) {
        const tags = Array.from(new Set(hashtags))
        await execute("/add", tags.join(" "), msg)
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
