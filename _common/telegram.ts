import { InlineKeyboardMarkup, Message } from 'telegram-typings'

export const encodeHtmlEntities = (raw: string): string => {
    const pairs: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
    }
    return raw.replace(/[&<>"]/g, (matched) => pairs[matched])
}

export const extractCommands = (
    msg: Message | undefined,
    botName?: string,
): { cmd: string; arg: string }[] => {
    if (!msg || !msg.text || !msg.entities) return []
    const text = msg.text
    const commands = msg.entities
        .filter((entity) => entity.type === 'bot_command')
        .map((entity) => {
            const cmds = text.substr(entity.offset, entity.length).split('@')
            if (
                cmds.length === 1 ||
                (cmds.length === 2 && botName && cmds[1] === botName)
            ) {
                return { cmd: cmds[0], off: entity.offset, len: entity.length }
            } else {
                return null
            }
        })
        .filter(Boolean) as { cmd: string; off: number; len: number }[]

    const cmds: { cmd: string; arg: string }[] = []
    let i = 0
    while (i < commands.length) {
        const command = commands[i]
        const nextOffset =
            i + 1 < commands.length ? commands[i + 1].off : text.length
        const arg = text.substring(command.off + command.len, nextOffset)
        cmds.push({ cmd: command.cmd, arg })
        i++
    }
    return cmds
}

type SendMessage = {
    chat_id: number
    text: string
    parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown'
    disable_web_page_preview?: boolean
    disable_notification?: boolean
    reply_to_message_id?: number
    reply_markup?: InlineKeyboardMarkup
}
type SendPhoto = {
    chat_id: number
    photo: string // file_id
    caption?: string
    parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown'
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
    parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown'
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
    parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown'
    supports_streaming?: boolean
    disable_notification?: boolean
    reply_to_message_id?: number
    reply_markup?: InlineKeyboardMarkup
}
type AnswerCallbackQuery = {
    callback_query_id: string
    text?: string
    show_alert?: boolean
    url?: string
    cache_time?: number
}

export class TelegramClient {
    private token: string
    constructor(token: string) {
        this.token = token
    }

    async send(type: 'sendMessage', data: SendMessage): Promise<Response>
    async send(type: 'sendPhoto', data: SendPhoto): Promise<Response>
    async send(type: 'sendAnimation', data: SendAnimation): Promise<Response>
    async send(type: 'sendVideo', data: SendVideo): Promise<Response>
    async send(
        type: 'answerCallbackQuery',
        data: AnswerCallbackQuery,
    ): Promise<Response>
    async send(type: unknown, data: unknown) {
        const url = `https://api.telegram.org/bot${this.token}/${type}`
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
        return resp
    }
}
