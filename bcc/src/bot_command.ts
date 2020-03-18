import { Message } from 'telegram-typings'
import { sendMessage } from './service/telegram'
import * as db from './db'

declare const BCC_BOT_TOKEN: string

const actions = new Map<
    string,
    (args: string[], msg: Message) => Promise<void>
>()

actions.set('/start', async (_args: string[], msg: Message) => {
    await sendMessage(BCC_BOT_TOKEN, { chat_id: msg.chat.id, text: 'hello' })
})

actions.set('/list', async (_args: string[], msg: Message) => {
    const chat_id = msg.chat.id
    const tags = await db.getTags(chat_id)
    const text = tags.length === 0 ? 'not found' : tags.join('\n')
    await sendMessage(BCC_BOT_TOKEN, { chat_id, text })
})

actions.set('/whoami', async (_args: string[], msg: Message) => {
    if (msg.forward_from) return
    const user = msg.from
    if (user) {
        const chat_id = msg.chat.id
        const text = JSON.stringify(user, null, 4)
        await sendMessage(BCC_BOT_TOKEN, {
            chat_id,
            text,
            reply_to_message_id: msg.message_id,
        })
    }
})

export const execute = async (cmd: string, args: string[], msg: Message) => {
    const act = actions.get(cmd)
    if (act !== undefined) {
        await act(args, msg)
    }
}
