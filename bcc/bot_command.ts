import { Message } from 'telegram-typings'
import { TelegramClient } from '../_common/telegram'
import { Database } from '../_common/database'
import type { PGArray } from '../_common/database'

declare const BCC_BOT_TOKEN: string
declare const DB_API: string
declare const DB_TOKEN: string

const telegram = new TelegramClient(BCC_BOT_TOKEN)
const database = new Database(DB_API, DB_TOKEN)
const actions = new Map<string, (arg: string, msg: Message) => Promise<void>>()

actions.set('/add_tags', async (tags: string, msg: Message) => {
    await database.query(
        `
            WITH t(tags) AS (
                SELECT ARRAY(
                    SELECT UNNEST($2::TEXT[])
                    UNION
                    SELECT UNNEST(tags) FROM bcc WHERE chat_id=$1
                )
            )
            INSERT INTO bcc(chat_id, tags) SELECT $1, tags FROM t
            ON CONFLICT(chat_id)
            DO UPDATE SET tags = EXCLUDED.tags
        `,
        msg.chat.id,
        tags.trim().split(/\s+/),
    )
})

actions.set('/remove_tags', async (tags: string, msg: Message) => {
    await database.query(
        `
            WITH t(tags) AS (
                SELECT ARRAY(
                    SELECT UNNEST(tags) FROM bcc WHERE chat_id=$1
                    EXCEPT
                    SELECT UNNEST($2::TEXT[])
                )
            )
            update bcc set tags = t.tags from t where bcc.chat_id=$1
        `,
        msg.chat.id,
        tags.trim().split(/\s+/),
    )
})

actions.set('/list', async (_arg: string, msg: Message) => {
    const chat_id = msg.chat.id
    const arr = await database.queryOne<PGArray<string>>(
        'SELECT tags FROM bcc WHERE chat_id=$1',
        chat_id,
    )
    if (arr === null || arr[0].Elements.length  === 0) {
        await telegram.send('sendMessage', { chat_id, text: 'not found' })
    } else {
        const tags = arr[0].Elements.sort()
        const text = tags.reduce(
            (prev, curr) => {
                if (prev.tag[1] === curr[1]) {
                    prev.text += ' ' + curr
                } else {
                    prev.text += '\n' + curr
                    prev.tag = curr
                }
                return prev
            },
            { tag: '', text: '' },
        )
        await telegram.send('sendMessage', { chat_id, text: text.text })
    }
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
