import { Message } from "telegram-typings"
import { Telegram } from "../../_common/telegram"

declare const MZBOT_BOT_TOKEN: string

const telegram = new Telegram(MZBOT_BOT_TOKEN)

const actions = new Map<
	string,
	(args: string[], msg: Message) => Promise<string>
>()

actions.set("post_photo", async (chatId: string[], msg: Message) => {
	if (!msg.photo) return "post | empty"
	const photo = msg.photo.reduce((x, y) => {
		if (x.width * x.height >= y.width * y.height) {
			return x
		} else {
			return y
		}
	})
	await telegram.send("sendPhoto", {
		chat_id: Number(chatId[0]),
		photo: photo.file_id,
	})
	return "post | done"
})

actions.set("post_animation", async (chatId: string[], msg: Message) => {
	if (!msg.animation) return "post | empty"
	const m = msg.animation
	await telegram.send("sendAnimation", {
		chat_id: Number(chatId[0]),
		animation: m.file_id,
		duration: m.duration,
		width: m.width,
		height: m.height,
		thumb: m.thumb?.file_id,
	})
	return "post | done"
})

actions.set("post_video", async (chatId: string[], msg: Message) => {
	if (!msg.video) return "post | empty"
	const m = msg.video
	await telegram.send("sendVideo", {
		chat_id: Number(chatId[0]),
		video: m.file_id,
		duration: m.duration,
		width: m.width,
		height: m.height,
		thumb: m.thumb?.file_id,
	})
	return "post | done"
})

export const execute = (cmd: string, args: string[], msg: Message) => {
	const act = actions.get(cmd)
	if (act !== undefined) {
		return act(args, msg)
	} else {
		return "unknown action"
	}
}
