export const encodeHtmlEntities = (raw: string): string => {
    const pairs: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
    }
    return raw.replace(/[&<>"]/g, (matched) => pairs[matched])
}

interface SendMessage {
    chat_id: number
    text: string
    parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown'
    disable_web_page_preview?: boolean
    disable_notification?: boolean
    reply_to_message_id?: number
}

export const sendMessage = async (token: string, msg: SendMessage) => {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(msg),
    })
    return resp
}

interface SendPhoto {
    chat_id: number
    photo: string // file_id
    caption?: string
    parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown'
    disable_notification?: boolean
    reply_to_message_id?: number
}

export const sendPhoto = async (token: string, data: SendPhoto) => {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    return resp
}
