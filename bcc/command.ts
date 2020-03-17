import { Message } from 'telegram-typings'
import * as db from './db'

declare const BCC_BOT_TOKEN: string

interface SendMessage {
    chat_id: number
    text: string
    parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown'
    disable_web_page_preview?: boolean
    disable_notification?: boolean
    reply_to_message_id?: number
}

async function sendMessage(msg: SendMessage) {
    const url = `https://api.telegram.org/bot${BCC_BOT_TOKEN}/sendMessage`
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(msg),
    })
    return resp
}

const actions = new Map<string, (args: string[], msg: Message) => void>()

actions.set('/start', async (_args: string[], msg: Message) => {
    await sendMessage({ chat_id: msg.chat.id, text: 'hello' })
})

actions.set('/list', async (_args: string[], msg: Message) => {
    const chat_id = msg.chat.id
    try {
        const tags = await db.getTags(chat_id)
        const text = tags.length === 0 ? 'not found' : tags.join('\n')
        await sendMessage({
            chat_id,
            text,
        })
    } catch (err) {
        const text = `${err}\n${err.stack}`
        await sendMessage({
            chat_id,
            text,
        })
    }
})

actions.set('/whoami', async (_args: string[], msg: Message) => {
    if (msg.forward_from) return
    const user = msg.from
    if (user) {
        const chat_id = msg.chat.id
        const text = JSON.stringify(user, null, 4)
        await sendMessage({
            chat_id,
            text,
            reply_to_message_id: msg.message_id,
        })
    }
})

export const execute = async (cmd: string, args: string[], msg: Message) => {
    const act = actions.get(cmd)
    if (act !== undefined) {
        act(args, msg)
    }
}
