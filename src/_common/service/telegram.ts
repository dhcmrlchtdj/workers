import type {
	AnswerCallbackQuery,
	ChatMember,
	EditMessageText,
	File,
	GetChatMember,
	Message,
	SendAnimation,
	SendMessage,
	SendPhoto,
	SendVideo,
} from "./telegram-typings.ts"
import * as S from "../http/request.ts"

export const encodeHtmlEntities = (raw: string): string => {
	const pairs: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
	}
	return raw.replaceAll(/[&<>"]/g, (matched) => pairs[matched]!)
}

function telegram(
	token: string,
	method: "sendMessage",
): (data: SendMessage) => Promise<Message>
function telegram(
	token: string,
	method: "sendPhoto",
): (data: SendPhoto) => Promise<Message>
function telegram(
	token: string,
	method: "sendAnimation",
): (data: SendAnimation) => Promise<Message>
function telegram(
	token: string,
	method: "sendVideo",
): (data: SendVideo) => Promise<Message>
function telegram(
	token: string,
	method: "editMessageText",
): (data: EditMessageText) => Promise<Message | boolean>
function telegram(
	token: string,
	method: "getChatMember",
): (data: GetChatMember) => Promise<ChatMember>
function telegram(
	token: string,
	method: "answerCallbackQuery",
): (data: AnswerCallbackQuery) => Promise<boolean>
function telegram(
	token: string,
	method: "getFile",
): (data: { file_id: string }) => Promise<File>
function telegram(token: string, method: string) {
	const fn = (data: unknown) => send(token, method, data)
	return fn as unknown
}
export { telegram }

async function send(
	token: string,
	method: string,
	data: unknown,
): Promise<unknown> {
	const url = `https://api.telegram.org/bot${token}/${method}`

	type ResponseType =
		| { ok: true; result: unknown; description?: string }
		| { ok: false; error_code: number; description: string }

	const req = S.build(S.post(url), S.json(data))
	const body = await fetch(req).then((r) => r.json<ResponseType>())

	if (body.ok) {
		return body.result
	} else {
		throw new Error(JSON.stringify(body))
	}
}

///

export function sentByMe(username: string, msg: Message): boolean {
	return !!(msg.from?.is_bot && msg.from.username === username)
}

export async function fromAdmin(token: string, msg: Message): Promise<boolean> {
	const chatType = msg.chat.type
	if (chatType === "group" || chatType === "supergroup") {
		const getChatMember = telegram(token, "getChatMember")
		const member = await getChatMember({
			chat_id: msg.chat.id,
			user_id: msg.from!.id,
		})
		return member.status === "creator" || member.status === "administrator"
	}
	return true
}

export function extractCommand(
	msg: Message,
	botName: string,
): { cmd: string; arg: string } | undefined {
	if (!msg.text || !msg.entities) return undefined
	const text = msg.text
	const command = msg.entities
		.filter((entity) => entity.type === "bot_command")
		.map((entity) => {
			const cmdEnd = entity.offset + entity.length
			let cmd = text.slice(entity.offset, cmdEnd)
			if (cmd.endsWith(botName)) {
				cmd = cmd.slice(0, cmd.length - botName.length)
			}
			const arg = text.slice(cmdEnd).trim()
			return { cmd, arg }
		})
		.find((x) => x !== undefined)
	return command
}

export function filterUrl(msg: Message): string[] {
	if (!msg.text || !msg.entities) return []
	const text = msg.text
	let hasCommand = false
	const url = msg.entities
		.map((entity) => {
			if (entity.type === "bot_command") {
				hasCommand = true
				return ""
			} else if (entity.type === "url") {
				return text.slice(entity.offset, entity.offset + entity.length)
			} else if (entity.type === "text_link") {
				return entity.url!
			} else {
				return ""
			}
		})
		.filter(Boolean)
	return hasCommand ? [] : url
}
