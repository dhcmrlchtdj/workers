import { Update, Message, User } from 'telegram-typings'
import { sendPhoto } from '../_common/telegram'

declare const MZBOT_BOT_TOKEN: string
declare const MY_TELEGRAM_CHAT_ID: string

const getUser = (u: User | undefined) => {
    if (!u) return 'unknown'
    if (u.username) return `@${u.username} (${u.id})`
    return `${u.first_name} (${u.id})}`
}

const handleMsg = async (msg: Message | undefined) => {
    if (!msg) return
    // await sendMessage(MZBOT_BOT_TOKEN, {
    //     chat_id: Number(MY_TELEGRAM_CHAT_ID),
    //     text: JSON.stringify(msg, null, 4),
    // })
    if (msg.photo) {
        const user = getUser(msg.from)
        const photo = msg.photo.reduce((x, y) => {
            if (x.width * x.height >= y.width * y.height) {
                return x
            } else {
                return y
            }
        })
        await sendPhoto(MZBOT_BOT_TOKEN, {
            chat_id: Number(MY_TELEGRAM_CHAT_ID),
            photo: photo.file_id,
            caption: `from ${user}`,
        })
    }
}

export const webhook = async (request: Request) => {
    const payload: Update = await request.json()
    await handleMsg(payload.message)
    return new Response('ok', { status: 200 })
}
