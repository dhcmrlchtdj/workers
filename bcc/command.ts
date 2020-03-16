import { Message } from 'telegram-typings'
import { TelegramClient } from '../common/telegram'
import * as data from './data'

// from worker environment
declare const BCC_BOT_TOKEN: string

const actions = new Map<string, (args: string[], msg: Message) => void>()
const client = new TelegramClient(BCC_BOT_TOKEN!)

export const dispatch = (cmd: string, args: string[], msg: Message) => {
    const act = actions.get(cmd)
    if (act !== undefined) {
        act(args, msg)
    }
}

actions.set('/start', async (_args: string[], msg: Message) => {
    await client.sendMessage({ chat_id: msg.chat.id, text: 'hello' })
})

actions.set('/list', async (_args: string[], msg: Message) => {
    const chat_id = msg.chat.id
    const tags = await data.getTags(chat_id)
    const text = tags.length === 0 ? 'not found' : tags.join('\n')
    await client.sendMessage({
        chat_id,
        text,
    })
})

actions.set('/whoami', async (_args: string[], msg: Message) => {
    if (msg.forward_from) return
    const user = msg.from
    if (user) {
        const chat_id = msg.chat.id
        const text = JSON.stringify(user, null, 4)
        await client.sendMessage({
            chat_id,
            text,
            reply_to_message_id: msg.message_id,
        })
    }
})
