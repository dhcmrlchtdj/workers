import type { Update, Message } from "../_common/service/telegram-typings.js"
import type { RouterContext } from "../_common/listen.js"
import { Telegram } from "../_common/service/telegram.js"
import type { Env } from "./types.js"
import { execute } from "./bot_command.js"

const handleMsg = async (env: Env, msg: Message) => {
	if (!msg.text || !msg.entities) return

	const telegram = new Telegram(env.BCC_BOT_TOKEN, "blind_carbon_copy_bot")
	const command = telegram.extractCommand(msg)
	if (command !== undefined && command.cmd !== "/add") {
		await execute(env, command.cmd, command.arg, msg)
		return
	}

	const hashtags = msg.entities
		.filter((x) => x.type === "hashtag")
		.map((entity) =>
			msg.text!.slice(entity.offset, entity.offset + entity.length),
		)
	if (hashtags.length > 0) {
		const tags = Array.from(new Set(hashtags))
		await execute(env, "/add", tags.join(" "), msg)
	}
}

const handle = (ctx: RouterContext<Env>, m: Message | undefined) => {
	if (m === undefined) return
	const task = handleMsg(ctx.env, m).catch((e) =>
		ctx.monitor.error(e, ctx.req),
	)
	ctx.ctx.waitUntil(task)
}

export const webhook = async (ctx: RouterContext<Env>) => {
	const payload: Update = await ctx.req.json()
	handle(ctx, payload.message)
	handle(ctx, payload.edited_message)
	handle(ctx, payload.channel_post)
	handle(ctx, payload.edited_channel_post)
	return new Response("ok")
}
