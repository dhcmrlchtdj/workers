import type {
    InlineKeyboardMarkup,
    Message,
    ChatMember,
} from 'telegram-typings'
import { check } from '../check_response'

export const encodeHtmlEntities = (raw: string): string => {
    const pairs = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
    }
    // @ts-ignore
    return raw.replace(/[&<>"]/g, (matched) => pairs[matched])
}

export class Telegram {
    private token: string
    private username: string | undefined
    constructor(token: string, username: string | undefined = undefined) {
        this.token = token
        this.username = username?.toLowerCase()
    }

    sentByMe(msg: Message): boolean {
        if (this.username === null) throw new Error('username is null')
        return !!(
            msg.from &&
            msg.from.is_bot &&
            msg.from.username == this.username
        )
    }

    extractCommand(msg: Message): { cmd: string; arg: string } | undefined {
        if (this.username === undefined) throw new Error('username undefined')
        if (!msg || !msg.text || !msg.entities) return undefined
        const text = msg.text
        const command = msg.entities
            .filter((entity) => entity.type === 'bot_command')
            .map((entity) => {
                const cmds = text
                    .substr(entity.offset, entity.length)
                    .split('@')
                if (
                    cmds.length === 1 ||
                    (cmds.length === 2 && cmds[1] === this.username)
                ) {
                    const cmd = cmds[0]!
                    const arg = text
                        .substring(entity.offset + entity.length)
                        .trim()
                    return { cmd, arg }
                } else {
                    return undefined
                }
            })
            .find((x) => x !== undefined)
        return command
    }

    async fromAdmin(msg: Message): Promise<boolean> {
        const chatType = msg.chat.type
        if (chatType === 'group' || chatType === 'supergroup') {
            const member = await this.send('getChatMember', {
                chat_id: msg.chat.id,
                user_id: msg.from!.id,
            })
            return (
                member.status === 'creator' || member.status === 'administrator'
            )
        }
        return true
    }

    async send(method: 'sendMessage', data: SendMessage): Promise<Message>
    async send(method: 'sendPhoto', data: SendPhoto): Promise<Message>
    async send(method: 'sendAnimation', data: SendAnimation): Promise<Message>
    async send(method: 'sendVideo', data: SendVideo): Promise<Message>
    async send(
        method: 'editMessageText',
        data: EditMessageText,
    ): Promise<Message | boolean>
    async send(
        method: 'getChatMember',
        data: GetChatMember,
    ): Promise<ChatMember>
    async send(
        method: 'answerCallbackQuery',
        data: AnswerCallbackQuery,
    ): Promise<boolean>

    async send(method: unknown, data: unknown): Promise<unknown> {
        const url = `https://api.telegram.org/bot${this.token}/${method}`
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
        await check(resp)

        const body: TGResponse = await resp.json()
        if (body.ok) {
            return body.result
        } else {
            throw new Error(body.description)
        }
    }
}

type TGResponse =
    | {
          ok: true
          result: unknown
          description?: string
      }
    | {
          ok: false
          error_code: number
          description: string
      }

type SendMessage = {
    chat_id: number
    text: string
    parse_mode?: 'MarkdownV2' | 'HTML'
    disable_web_page_preview?: boolean
    disable_notification?: boolean
    reply_to_message_id?: number
    reply_markup?: InlineKeyboardMarkup
}
type SendPhoto = {
    chat_id: number
    photo: string // file_id
    caption?: string
    parse_mode?: 'MarkdownV2' | 'HTML'
    disable_notification?: boolean
    reply_to_message_id?: number
    reply_markup?: InlineKeyboardMarkup
}
type SendAnimation = {
    chat_id: number
    animation: string // file_id
    duration?: number
    width?: number
    height?: number
    thumb?: string // file_id
    caption?: string
    parse_mode?: 'MarkdownV2' | 'HTML'
    disable_notification?: boolean
    reply_to_message_id?: number
    reply_markup?: InlineKeyboardMarkup
}
type SendVideo = {
    chat_id: number
    video: string // file_id
    duration?: number
    width?: number
    height?: number
    thumb?: string // file_id
    caption?: string
    parse_mode?: 'MarkdownV2' | 'HTML'
    supports_streaming?: boolean
    disable_notification?: boolean
    reply_to_message_id?: number
    reply_markup?: InlineKeyboardMarkup
}
type EditMessageText =
    | {
          chat_id: number
          message_id: number
          text: string
          parse_mode?: 'MarkdownV2' | 'HTML'
          disable_web_page_preview?: boolean
          reply_markup?: InlineKeyboardMarkup
      }
    | {
          inline_message_id: string
          text: string
          parse_mode?: 'MarkdownV2' | 'HTML'
          disable_web_page_preview?: boolean
          reply_markup?: InlineKeyboardMarkup
      }
type AnswerCallbackQuery = {
    callback_query_id: string
    text?: string
    show_alert?: boolean
    url?: string
    cache_time?: number
}
type GetChatMember = {
    chat_id: number
    user_id: number
}
