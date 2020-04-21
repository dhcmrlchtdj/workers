import { Update, Message } from 'telegram-typings'
import { sendPhoto } from '../_common/telegram'

declare const MZBOT_BOT_TOKEN: string
declare const MY_TELEGRAM_CHAT_ID: string

const handleMsg = async (msg: Message | undefined) => {
    if (!msg) return
    if (!msg.photo) return
    await Promise.all(
        msg.photo.map(async (p) => {
            await sendPhoto(MZBOT_BOT_TOKEN, {
                chat_id: Number(MY_TELEGRAM_CHAT_ID),
                photo: p.file_id,
            })
        }),
    )
}

export const webhook = async (request: Request) => {
    const payload: Update = await request.json()
    await Promise.all([
        handleMsg(payload.message),
        handleMsg(payload.edited_message),
        handleMsg(payload.channel_post),
        handleMsg(payload.edited_channel_post),
    ])
    return new Response('ok', { status: 200 })
}