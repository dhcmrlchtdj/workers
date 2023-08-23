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
	filterUrl,
	telegram,
} from "../_common/service/telegram.js"
import type {
	CallbackQuery,
	InlineKeyboardMarkup,
	Message,
	Update,
} from "../_common/service/telegram-typings.js"
import {
	keyToSharedUrl,
	randomKey,
	sharedUrlToKey,
	stringifyError,
	uploadByBuffer,
	uploadByUrl,
} from "./util.js"
import { fromStr } from "../_common/array_buffer.js"

type ENV = {
	BA: KVNamespace
	R2share: R2Bucket
	R2apac: R2Bucket
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
			W.serverTiming(),
			W.checkContentType(MIME_JSON),
			async ({ req, env, ec }) => {
				const end = W.addServerTiming("kv")
				const bot = await env.BA.get<KV_BOT>("telegram:share", {
					type: "json",
					cacheTtl: 60 * 60, // 60min
				})
				end()
				if (bot === null) return HttpInternalServerError("config")

				const secretToken = req.headers.get(
					"x-telegram-bot-api-secret-token",
				)
				if (bot.webhookSecretToken !== secretToken) {
					return HttpBadRequest("secret token")
				}

				const payload = await req.json<Update>()

				if (payload.message) {
					const isAdmin = payload.message.from?.id === bot.admin
					if (isAdmin) {
						handleMessage({
							ec,
							env,
							bot,
							msg: payload.message,
						})
					}
				}
				if (payload.callback_query) {
					const answer = async () => {
						const answerCallbackQuery = telegram(
							bot.token,
							"answerCallbackQuery",
						)
						await answerCallbackQuery({
							callback_query_id: payload.callback_query!.id,
						})
					}
					const isAdmin =
						payload.callback_query.from?.id === bot.admin
					if (!isAdmin) {
						ec.waitUntil(answer())
					} else {
						const r = handleCallback({
							ec,
							env,
							bot,
							cb: payload.callback_query,
						})
						await r
						ec.waitUntil(r.then(answer))
						ec.waitUntil(r.catch(answer))
					}
				}

				return HttpOk()
			},
		)
		return router.handle(req, env, ec)
	},
}
export default exportedHandler

///

type BotContextCallback = {
	ec: ExecutionContext
	env: ENV
	bot: KV_BOT
	cb: CallbackQuery
}

async function handleCallback(ctx: BotContextCallback) {
	if (!(ctx.cb.data && ctx.cb.message)) return
	const data = await ctx.env.R2apac.get(ctx.cb.data)
	if (!data) return
	const pagingInfo = JSON.parse(await data.text()) as ListPagingInfo

	const lst = await ctx.env.R2share.list(
		pagingInfo.cursor
			? {
					limit: 10,
					cursor: pagingInfo.cursor,
			  }
			: { limit: 10 },
	)
	const urls = lst.objects.map((x) => keyToSharedUrl(x.key))
	const msg = urls.join("\n\n")

	const btns: InlineKeyboardMarkup = { inline_keyboard: [[]] }
	if (pagingInfo.prevName) {
		btns.inline_keyboard[0]!.push({
			text: "prev 10",
			callback_data: pagingInfo.prevName,
		})
	}
	if (lst.truncated) {
		if (pagingInfo.nextPage) {
			btns.inline_keyboard[0]!.push({
				text: "next 10",
				callback_data: pagingInfo.nextPage,
			})
		} else {
			const next = "box-share/" + randomKey()
			await Promise.all([
				ctx.env.R2apac.put(
					pagingInfo.currName,
					JSON.stringify({
						...pagingInfo,
						nextPage: next,
					} satisfies ListPagingInfo),
				),
				ctx.env.R2apac.put(
					next,
					JSON.stringify({
						cursor: lst.cursor,
						currName: next,
						prevName: pagingInfo.currName,
						nextPage: null,
					} satisfies ListPagingInfo),
				),
			])
			btns.inline_keyboard[0]!.push({
				text: "next 10",
				callback_data: next,
			})
		}
	}
	if (btns.inline_keyboard[0]!.length === 0) {
		btns.inline_keyboard = []
	}

	const editMessageText = telegram(ctx.bot.token, "editMessageText")
	await editMessageText({
		chat_id: ctx.cb.message.chat.id,
		message_id: ctx.cb.message.message_id,
		parse_mode: "HTML",
		disable_web_page_preview: true,
		text: encodeHtmlEntities(msg),
		reply_markup: btns,
	})
}

type BotContextMessage = {
	ec: ExecutionContext
	env: ENV
	bot: KV_BOT
	msg: Message
}

function handleMessage(ctx: BotContextMessage) {
	const tasks = [
		uploadMessageFiles(ctx),
		uploadMessageUrl(ctx),
		handleCommand(ctx),
	]
	tasks.forEach((t) => ctx.ec.waitUntil(t))
}

async function handleCommand(ctx: BotContextMessage) {
	const cmd = extractCommand(ctx.msg, ctx.bot.name)
	if (!cmd) return
	switch (cmd.cmd) {
		case "/echo": {
			const msg = JSON.stringify(ctx.msg, null, 4)
			const sendMessage = telegram(ctx.bot.token, "sendMessage")
			await sendMessage({
				parse_mode: "HTML",
				chat_id: ctx.msg.chat.id,
				text: `<pre>${encodeHtmlEntities(msg)}</pre>`,
				disable_web_page_preview: true,
			})
			return
		}
		case "/delete": {
			const key = cmd.arg
				.split(/\s+/)
				.map((x) => sharedUrlToKey(x))
				.filter(Boolean)
			if (key.length === 0) return
			const msg = await ctx.env.R2share.delete(key)
				.then(() => key.join("\n\n") + "\n\ndeleted")
				.catch((e) => stringifyError(e, true))
			const sendMessage = telegram(ctx.bot.token, "sendMessage")
			await sendMessage({
				parse_mode: "HTML",
				chat_id: ctx.msg.chat.id,
				text: encodeHtmlEntities(msg),
				disable_web_page_preview: true,
			})
			return
		}
		case "/save": {
			const reply = ctx.msg.reply_to_message
			if (!(reply && reply.text)) return
			const sendMessage = telegram(ctx.bot.token, "sendMessage")
			const editMessageText = telegram(ctx.bot.token, "editMessageText")
			const uploading = await sendMessage({
				parse_mode: "HTML",
				chat_id: ctx.msg.chat.id,
				reply_to_message_id: ctx.msg.message_id,
				text: "uploading...",
				disable_web_page_preview: true,
			})
			await uploadByBuffer(
				ctx.env,
				fromStr(reply.text),
				undefined,
				undefined,
			)
				.then((sharedUrl) => encodeHtmlEntities(sharedUrl))
				.catch(
					(e) =>
						`<pre>${encodeHtmlEntities(
							stringifyError(e, true),
						)}</pre>`,
				)
				.then((text) => {
					return editMessageText({
						chat_id: uploading.chat.id,
						message_id: uploading.message_id,
						parse_mode: "HTML",
						disable_web_page_preview: true,
						text,
					})
				})
			return
		}
		case "/list": {
			const lst = await ctx.env.R2share.list({ limit: 10 })
			const urls = lst.objects.map((x) => keyToSharedUrl(x.key))
			const msg = urls.join("\n\n")

			const btns: InlineKeyboardMarkup = { inline_keyboard: [] }
			if (lst.truncated) {
				const curr = "box-share/" + randomKey()
				const next = "box-share/" + randomKey()
				await Promise.all([
					ctx.env.R2apac.put(
						curr,
						JSON.stringify({
							cursor: "",
							currName: curr,
							prevName: null,
							nextPage: next,
						} satisfies ListPagingInfo),
					),
					ctx.env.R2apac.put(
						next,
						JSON.stringify({
							cursor: lst.cursor,
							currName: next,
							prevName: curr,
							nextPage: null,
						} satisfies ListPagingInfo),
					),
				])
				btns.inline_keyboard.push([
					{
						text: "next 10",
						callback_data: next,
					},
				])
			}

			const sendMessage = telegram(ctx.bot.token, "sendMessage")
			await sendMessage({
				parse_mode: "HTML",
				chat_id: ctx.msg.chat.id,
				text: encodeHtmlEntities(msg),
				disable_web_page_preview: true,
				reply_markup: btns,
			})
			return
		}
	}
}

async function uploadMessageUrl(ctx: BotContextMessage) {
	const url = filterUrl(ctx.msg)
	if (url.length === 0) return

	const sendMessage = telegram(ctx.bot.token, "sendMessage")
	const editMessageText = telegram(ctx.bot.token, "editMessageText")

	await Promise.all(
		url.map(async (u) => {
			const uploading = await sendMessage({
				parse_mode: "HTML",
				chat_id: ctx.msg.chat.id,
				reply_to_message_id: ctx.msg.message_id,
				text: "uploading...",
				disable_web_page_preview: true,
			})
			await uploadByUrl(ctx.env, u, undefined, undefined)
				.then((sharedUrl) => encodeHtmlEntities(sharedUrl))
				.catch(
					(e) =>
						`<pre>${encodeHtmlEntities(
							stringifyError(e, true),
						)}</pre>`,
				)
				.then((text) => {
					return editMessageText({
						chat_id: uploading.chat.id,
						message_id: uploading.message_id,
						parse_mode: "HTML",
						disable_web_page_preview: true,
						text,
					})
				})
		}),
	)
}

async function uploadMessageFiles(ctx: BotContextMessage) {
	const msg = ctx.msg
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
	{ bot, env, msg }: BotContextMessage,
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
		return null
	}

	const getFile = telegram(bot.token, "getFile")
	const fileInfo = await getFile({ file_id: fileId }).catch(handleError)
	if (!fileInfo) return

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
	const sharedUrl = await uploadByUrl(
		env,
		fileUrl,
		fileInfo.file_unique_id + (filename ? "." + filename : ""),
		contentType,
	).catch(handleError)
	if (!sharedUrl) return

	await editMessageText({
		chat_id: uploading.chat.id,
		message_id: uploading.message_id,
		parse_mode: "HTML",
		disable_web_page_preview: true,
		text: encodeHtmlEntities(sharedUrl),
	})
}

type ListPagingInfo = {
	cursor: string
	currName: string
	prevName: string | null
	nextPage: string | null
}
