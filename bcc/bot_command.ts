import { Message } from 'telegram-typings'
import { TelegramClient } from '../_common/telegram'
import { FaunaClient } from '../_common/fauna'

declare const BCC_BOT_TOKEN: string
declare const FAUNA_KEY: string

const telegram = new TelegramClient(BCC_BOT_TOKEN)
const fauna = new FaunaClient(FAUNA_KEY)
const actions = new Map<string, (arg: string, msg: Message) => Promise<void>>()

actions.set('/add_tags', async (tags: string, msg: Message) => {
    await fauna.execute('bcc_add_tags', msg.chat.id, tags.split(' '))
})

actions.set('/list', async (_arg: string, msg: Message) => {
    const chat_id = msg.chat.id
    const tags = await fauna.execute<string[]>('bcc_get_tags', chat_id)
    const text = tags.length === 0 ? 'not found' : tags.join('\n')
    await telegram.send('sendMessage', { chat_id, text })
})

actions.set('/whoami', async (_arg: string, msg: Message) => {
    const chat_id = msg.chat.id
    const text = JSON.stringify(
        {
            chat_id,
            ...(msg.from ?? {}),
        },
        null,
        4,
    )
    await telegram.send('sendMessage', {
        chat_id,
        text,
        reply_to_message_id: msg.message_id,
    })
})

export const execute = async (cmd: string, arg: string, msg: Message) => {
    const act = actions.get(cmd)
    if (act !== undefined) {
        await act(arg, msg)
    }
}
