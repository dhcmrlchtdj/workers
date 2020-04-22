import { Update, Message } from 'telegram-typings'
import { sendPhoto } from '../_common/telegram'

declare const MZBOT_BOT_TOKEN: string
declare const MY_TELEGRAM_CHAT_ID: string

const handleMsg = async (msg: Message | undefined) => {
    if (!msg) return
    if (!msg.from) return
    if (msg.photo) {
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
            caption: `from: ${msg.from.id}\nsize: ${photo.width}x${photo.height}`,
        })
    }
}

export const webhook = async (request: Request) => {
    const payload: Update = await request.json()
    await handleMsg(payload.message)
    return new Response('ok', { status: 200 })
}
