import type {
	Message,
	ChatMember,
	SendMessage,
	SendPhoto,
	SendAnimation,
	SendVideo,
	File,
	EditMessageText,
	GetChatMember,
	AnswerCallbackQuery,
} from "./telegram-typings.js"
import * as S from "../http/request.js"

export const encodeHtmlEntities = (raw: string): string => {
	const pairs: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
	}
	return raw.replace(/[&<>"]/g, (matched) => pairs[matched]!)
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
	method: unknown,
	data: unknown,
): Promise<unknown> {
	const url = `https://api.telegram.org/bot${token}/${method}`

	type ResponseType =
		| { ok: true; result: unknown; description?: string }
		| { ok: false; error_code: number; description: string }

	const body: ResponseType = await fetch(
		S.build(S.post(url), S.json(data)),
	).then((r) => r.json())

	if (body.ok) {
		return body.result
	} else {
		throw new Error(JSON.stringify(body))
	}
}

///

export function sentByMe(username: string, msg: Message): boolean {
	return !!(msg.from?.is_bot && msg.from.username == username)
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
	username: string,
	msg: Message,
): { cmd: string; arg: string } | undefined {
	if (!msg.text || !msg.entities) return undefined
	const text = msg.text
	const command = msg.entities
		.filter((entity) => entity.type === "bot_command")
		.map((entity) => {
			const cmds = text
				.slice(entity.offset, entity.offset + entity.length)
				.split("@")
			if (
				cmds.length === 1 ||
				(cmds.length === 2 && cmds[1] === username)
			) {
				const cmd = cmds[0]!
				const arg = text.slice(entity.offset + entity.length).trim()
				return { cmd, arg }
			} else {
				return undefined
			}
		})
		.find((x) => x !== undefined)
	return command
}
