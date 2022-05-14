import type { Update, Message } from "telegram-typings"
import type { RouterContext } from "../_common/listen"
import { Telegram } from "../_common/service/telegram"
import type { Env } from "./types"
import { execute } from "./bot_command"

const handleMsg = async (ctx: RouterContext<Env>, msg: Message) => {
    if (!msg.text || !msg.entities) return

    const telegram = new Telegram(
        ctx.env.BCC_BOT_TOKEN,
        "blind_carbon_copy_bot",
    )
    const command = telegram.extractCommand(msg)
    if (command !== undefined && command.cmd !== "/add") {
        await execute(ctx, command.cmd, command.arg, msg)
        return
    }

    const hashtags = msg.entities
        .filter((x) => x.type === "hashtag")
        .map((entity) => msg.text!.substr(entity.offset, entity.length))
    if (hashtags.length > 0) {
        const tags = Array.from(new Set(hashtags))
        await execute(ctx, "/add", tags.join(" "), msg)
    }
}

const handle = (ctx: RouterContext<Env>, m: Message | undefined) => {
    if (m === undefined) return
    const task = handleMsg(ctx, m).catch((e) =>
        ctx.monitor.error(e, ctx.request),
    )
    ctx.ctx.waitUntil(task)
}

export const webhook = async (ctx: RouterContext<Env>) => {
    const payload: Update = await ctx.request.json()
    handle(ctx, payload.message)
    handle(ctx, payload.edited_message)
    handle(ctx, payload.channel_post)
    handle(ctx, payload.edited_channel_post)
    return new Response("ok")
}
