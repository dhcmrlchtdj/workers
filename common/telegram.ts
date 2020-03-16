import * as T from 'telegram-typings'

// https://core.telegram.org/bots/api#getting-updates

interface GetUpdates {
    offset?: number
    limit?: number
    timeout?: number
    allowed_updates?: string[]
}

interface SetWebhook {
    url: string
    max_connections?: number
    allowed_updates?: string[]
}

interface WebhookInfo {
    url: string
    has_custom_certificate: boolean
    pending_update_count: number
    last_error_date?: number
    last_error_message?: string
    max_connections?: number
    allowed_updates?: string[]
}

// https://core.telegram.org/bots/api#available-methods

interface SendMessage {
    chat_id: number
    text: string
    parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown'
    disable_web_page_preview?: boolean
    disable_notification?: boolean
    reply_to_message_id?: number
    reply_markup?:
        | T.InlineKeyboardMarkup
        | T.ReplyKeyboardMarkup
        | T.ReplyKeyboardRemove
        | T.ForceReply
}

interface ForwardMessage {
    chat_id: number
    from_chat_id: number
    message_id: number
    disable_notification?: boolean
}

export class TelegramClient {
    private API_PREFIX: string

    constructor(token: string) {
        this.API_PREFIX = `https://api.telegram.org/bot${token}`
    }

    async getUpdates(payload: GetUpdates): Promise<T.Update[]> {
        const url = `${this.API_PREFIX}/getUpdates`
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'tg-bcc-bot',
            },
            body: JSON.stringify(payload),
        }).then(buf => buf.json())
        return resp
    }

    async setWebhook(payload: SetWebhook) {
        const url = `${this.API_PREFIX}/setWebhook`
        const form = new FormData()
        Object.entries(payload).forEach(([k, v]) => {
            form.append(k, v)
        })
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'User-Agent': 'tg-bcc-bot',
            },
            body: form,
        })
        return resp
    }

    async deleteWebhook() {
        const url = `${this.API_PREFIX}/deleteWebhook`
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'tg-bcc-bot',
            },
        })
        return resp
    }

    async getWebhookInfo(): Promise<WebhookInfo> {
        const url = `${this.API_PREFIX}/getWebhookInfo`
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'tg-bcc-bot',
            },
        }).then(buf => buf.json())
        return resp
    }

    async getMe(): Promise<T.User> {
        const url = `${this.API_PREFIX}/getMe`
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'tg-bcc-bot',
            },
        }).then(buf => buf.json())
        return resp
    }

    async sendMessage(payload: SendMessage): Promise<T.Message> {
        const url = `${this.API_PREFIX}/sendMessage`
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'tg-bcc-bot',
            },
            body: JSON.stringify(payload),
        }).then(buf => buf.json())
        return resp
    }

    async forwardMessage(payload: ForwardMessage): Promise<T.Message> {
        const url = `${this.API_PREFIX}/forwardMessage`
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'tg-bcc-bot',
            },
            body: JSON.stringify(payload),
        }).then(buf => buf.json())
        return resp
    }
}
