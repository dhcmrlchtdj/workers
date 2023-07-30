import * as M from "../_common/worker.middleware.js"
import { HttpInternalServerError, HttpOk } from "../_common/http/status.js"
import { telegram } from "../_common/service/telegram.js"
import type {
	Message,
	MessageEntity,
	Update,
} from "../_common/service/telegram-typings.js"

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
		const router = new M.Router<ENV>()
		router.use(M.sendErrorToTelegram("telegram-share"))
		router.route(
			"POST",
			"/telegram/share",
			M.checkContentType("json"),
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
					return HttpInternalServerError("secret token")
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
		return router.handle({ req, env, ec })
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
	if (ctx.msg.entities) {
		const tasks = ctx.msg.entities.map(async (entity) => {
			switch (entity.type) {
				case "bot_command": {
					return handleCommand(ctx, entity)
				}
				default: {
					return
				}
			}
		})
		await Promise.allSettled(tasks)
	}
	await uploadMessageFiles(ctx)
}

async function handleCommand(ctx: BotContext, entity: MessageEntity) {
	const text = ctx.msg.text
	if (!text) return

	let cmd = text.substr(entity.offset, entity.length)
	if (cmd.endsWith(ctx.bot.name)) {
		cmd = cmd.substr(0, cmd.length - ctx.bot.name.length)
	}

	// const endPos = entity.offset + entity.length
	// const args = text.slice(endPos).trim().split(/\s+/)

	switch (cmd) {
		case "/echo": {
			const sendMessage = telegram(ctx.bot.token, "sendMessage")
			await sendMessage({
				parse_mode: "HTML",
				chat_id: ctx.msg.chat.id,
				text: `<pre>${JSON.stringify(ctx.msg, null, 4)}</pre>`,
				disable_web_page_preview: true,
			})
		}
	}
}

async function uploadMessageFiles(ctx: BotContext) {
	const msg = ctx.msg

	const user = msg.from
	if (!user) return
	if (user.id !== ctx.bot.admin) return

	if (msg.document) {
		await uploadFile(
			ctx,
			msg.document.file_id,
			msg.document.file_name,
			msg.document.mime_type,
		)
	}
	if (msg.photo) {
		const tasks = msg.photo.map((p) =>
			uploadFile(ctx, p.file_id, "photo", "image/jpeg"),
		)
		await Promise.allSettled(tasks)
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
}

async function uploadFile(
	{ bot, env, msg }: BotContext,
	fileId: string,
	filename: string | undefined,
	contentType: string | undefined,
) {
	const getFile = telegram(bot.token, "getFile")
	const fileInfo = await getFile({ file_id: fileId })

	if (!fileInfo.file_path) {
		return
	}

	const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`
	const resp = await fetch(fileUrl)

	let objectKey = "telegram/" + fileInfo.file_unique_id
	if (filename) objectKey += "/" + filename
	const uploaded = await env.R2share.put(objectKey, resp.body, {
		httpMetadata: {
			contentType: contentType ?? "application/octet-stream",
		},
	})

	const sendMessage = telegram(bot.token, "sendMessage")
	await sendMessage({
		parse_mode: "HTML",
		chat_id: msg.chat.id,
		text: `https://worker.h11.io/share/${uploaded.key}`,
		disable_web_page_preview: true,
	})
}
