import { Message } from 'telegram-typings'
import { TelegramClient } from '../_common/telegram'
import { FaunaClient } from '../_common/fauna'

declare const BCC_BOT_TOKEN: string
declare const FAUNA_KEY: string

const telegram = new TelegramClient(BCC_BOT_TOKEN)
const fauna = new FaunaClient(FAUNA_KEY)
const actions = new Map<
    string,
    (args: string[], msg: Message) => Promise<void>
>()

actions.set('/start', async (_args: string[], msg: Message) => {
    await telegram.send('sendMessage', { chat_id: msg.chat.id, text: 'hello' })
})

actions.set('/add_tags', async (tags: string[], msg: Message) => {
    await fauna.execute('bcc_add_tags', msg.chat.id, tags)
})

actions.set('/list', async (_args: string[], msg: Message) => {
    const chat_id = msg.chat.id
    const tags = await fauna.execute<string[]>('bcc_get_tags', chat_id)
    const text = tags.length === 0 ? 'not found' : tags.join('\n')
    await telegram.send('sendMessage', { chat_id, text })
})

actions.set('/whoami', async (_args: string[], msg: Message) => {
    if (msg.forward_from) return
    const user = msg.from
    if (user) {
        const chat_id = msg.chat.id
        const text = JSON.stringify(user, null, 4)
        await telegram.send('sendMessage', {
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
