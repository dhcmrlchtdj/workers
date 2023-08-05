import * as W from "../_common/worker/index.js"
import { MIME_JSON } from "../_common/http/mime.js"
import {
	HttpBadRequest,
	HttpInternalServerError,
	HttpOk,
} from "../_common/http/status.js"
import {
	encodeHtmlEntities,
	extractCommand,
	telegram,
} from "../_common/service/telegram.js"
import type { Message, Update } from "../_common/service/telegram-typings.js"
import { detectContentType } from "../_common/http/sniff.js"

type ENV = {
	BA: KVNamespace
	R2share: R2Bucket
}

type KV_BOT = {
	name: string
	token: string
	webhookSecretToken: string
	admin: number
}

///

const exportedHandler: ExportedHandler<ENV> = {
	async fetch(req, env, ec) {
		const router = new W.Router<ENV>()
		router.post(
			"/telegram/share",
			W.sendErrorToTelegram("telegram-share"),
			W.checkContentType(MIME_JSON),
			async ({ req, env, ec }) => {
				const bot = await env.BA.get<KV_BOT>("telegram:share", {
					type: "json",
					cacheTtl: 60 * 60, // 60min
				})
				if (bot === null) return HttpInternalServerError("config")

				const secretToken = req.headers.get(
					"x-telegram-bot-api-secret-token",
				)
				if (bot.webhookSecretToken !== secretToken) {
					return HttpBadRequest("secret token")
				}

				const payload = await req.json<Update>()
				if (payload.message) {
					ec.waitUntil(
						handleMessage({ env, bot, msg: payload.message }),
					)
				}
				return HttpOk()
			},
		)
		return router.handle(req, env, ec)
	},
}
export default exportedHandler

///

type BotContext = {
	env: ENV
	bot: KV_BOT
	msg: Message
}

async function handleMessage(ctx: BotContext) {
	const cmd = extractCommand(ctx.msg, ctx.bot.name)
	if (cmd) {
		await handleCommand(ctx, cmd.cmd, cmd.arg)
	} else {
		await uploadMessageFiles(ctx)
	}
}

async function handleCommand(ctx: BotContext, cmd: string, _arg: string) {
	switch (cmd) {
		case "/echo": {
			const msg = JSON.stringify(ctx.msg, null, 4)
			const sendMessage = telegram(ctx.bot.token, "sendMessage")
			await sendMessage({
				parse_mode: "HTML",
				chat_id: ctx.msg.chat.id,
				text: `<pre>${encodeHtmlEntities(msg)}</pre>`,
				disable_web_page_preview: true,
			})
			break
		}
	}
}

async function uploadMessageFiles(ctx: BotContext) {
	const msg = ctx.msg

	const chat = msg.chat
	if (chat.id !== ctx.bot.admin) return

	if (msg.document) {
		await uploadFile(
			ctx,
			msg.document.file_id,
			msg.document.file_name,
			msg.document.mime_type,
		)
	}
	if (msg.photo && msg.photo.length > 0) {
		msg.photo.sort((a, b) => {
			if (a.width > b.width) {
				return -1
			} else if (a.height > b.height) {
				return -1
			} else {
				return 1
			}
		})
		await uploadFile(ctx, msg.photo[0]!.file_id, "photo", undefined)
	}
	if (msg.audio) {
		await uploadFile(
			ctx,
			msg.audio.file_id,
			msg.audio.file_name,
			msg.audio.mime_type,
		)
	}
	if (msg.video) {
		await uploadFile(
			ctx,
			msg.video.file_id,
			msg.video.file_name,
			msg.video.mime_type,
		)
	}
	if (msg.voice) {
		await uploadFile(ctx, msg.voice.file_id, "voice", msg.voice.mime_type)
	}
	if (msg.video_note) {
		await uploadFile(ctx, msg.video_note.file_id, "voice_note", undefined)
	}
	if (msg.sticker) {
		await uploadFile(
			ctx,
			msg.sticker.file_id,
			msg.sticker.set_name,
			undefined,
		)
	}
}

async function uploadFile(
	{ bot, env, msg }: BotContext,
	fileId: string,
	filename: string | undefined,
	contentType: string | undefined,
) {
	const sendMessage = telegram(bot.token, "sendMessage")
	const uploading = await sendMessage({
		parse_mode: "HTML",
		chat_id: msg.chat.id,
		reply_to_message_id: msg.message_id,
		text: "uploading...",
		disable_web_page_preview: true,
	})
	const editMessageText = telegram(bot.token, "editMessageText")
	const handleError = async (e: unknown) => {
		await editMessageText({
			chat_id: uploading.chat.id,
			message_id: uploading.message_id,
			parse_mode: "HTML",
			disable_web_page_preview: true,
			text: `<pre>${encodeHtmlEntities(String(e))}</pre>`,
		})
		throw e
	}

	const getFile = telegram(bot.token, "getFile")
	const fileInfo = await getFile({ file_id: fileId }).catch(handleError)

	if (!fileInfo.file_path) {
		const data = JSON.stringify(fileInfo, null, 4)
		await editMessageText({
			chat_id: uploading.chat.id,
			message_id: uploading.message_id,
			parse_mode: "HTML",
			disable_web_page_preview: true,
			text: `couldn't fetch file path<br><pre>${encodeHtmlEntities(
				data,
			)}</pre>`,
		})
		return
	}

	const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`
	const resp = await fetch(fileUrl)
	const body = await resp.arrayBuffer()

	let objectKey = `${Date.now()}.${fileInfo.file_unique_id}`
	if (filename) objectKey += "." + filename

	const uploaded = await env.R2share.put(
		encodeURIComponent(objectKey),
		body,
		{
			httpMetadata: {
				contentType: contentType ?? detectContentType(body),
			},
			customMetadata: {
				via: "telegram-bot",
			},
		},
	).catch(handleError)

	const sharedUrl = "https://worker.h11.io/share/" + uploaded.key
	await editMessageText({
		chat_id: uploading.chat.id,
		message_id: uploading.message_id,
		parse_mode: "HTML",
		disable_web_page_preview: true,
		text: encodeHtmlEntities(sharedUrl),
	})
}
