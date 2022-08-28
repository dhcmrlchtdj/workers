import { Update, Message, CallbackQuery } from "telegram-typings"
import { Telegram } from "../../_common/telegram"
import { execute } from "./callback_action"

declare const MZBOT_BOT_TOKEN: string
declare const MY_TELEGRAM_CHAT_ID: string

const telegram = new Telegram(MZBOT_BOT_TOKEN)

const handleMsg = async (msg: Message | undefined) => {
	if (!msg) return
	if (!msg.from) return

	if (msg.photo) {
		const photo = msg.photo.reduce((x, y) => {
			if (x.width * x.height >= y.width * y.height) {
				return x
			} else {
				return y
			}
		})
		await telegram.send("sendPhoto", {
			photo: photo.file_id,
			chat_id: Number(MY_TELEGRAM_CHAT_ID),
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: "Post",
							callback_data: "post_photo -1001409094703",
						},
					],
				],
			},
		})
	}
	if (msg.animation) {
		const m = msg.animation
		await telegram.send("sendAnimation", {
			animation: m.file_id,
			duration: m.duration,
			width: m.width,
			height: m.height,
			thumb: m.thumb?.file_id,
			chat_id: Number(MY_TELEGRAM_CHAT_ID),
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: "Post",
							callback_data: "post_animation -1001409094703",
						},
					],
				],
			},
		})
	}
	if (msg.video) {
		const m = msg.video
		await telegram.send("sendVideo", {
			video: m.file_id,
			duration: m.duration,
			width: m.width,
			height: m.height,
			thumb: m.thumb?.file_id,
			chat_id: Number(MY_TELEGRAM_CHAT_ID),
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: "Post",
							callback_data: "post_video -1001409094703",
						},
					],
				],
			},
		})
	}
}

const handleCallback = async (data: CallbackQuery | undefined) => {
	if (!data) return
	const msg = data.message
	const command = data.data
	if (!msg || !command) {
		await telegram.send("sendMessage", {
			chat_id: data.from.id,
			text: "the message/data is unavailable",
		})
		return
	}
	const args = command.split(/\s+/)
	const cmd = args.shift()!
	const reply = await execute(cmd, args, msg)
	await telegram.send("answerCallbackQuery", {
		callback_query_id: data.id,
		text: reply,
	})
}

export const webhook = async (request: Request) => {
	const payload: Update = await request.json()
	await Promise.all([
		handleMsg(payload.message),
		handleMsg(payload.edited_message),
		handleCallback(payload.callback_query),
	])
	return new Response("ok", { status: 200 })
}
