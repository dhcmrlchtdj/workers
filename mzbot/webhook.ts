import { Update, Message, CallbackQuery } from 'telegram-typings'
import {
    sendPhoto,
    sendMessage,
    answerCallbackQuery,
} from '../_common/telegram'
import { execute } from './callback_action'

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
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Post',
                            callback_data: 'post_photo -1001409094703',
                        },
                    ],
                ],
            },
        })
    }
}

const handleCallback = async (data: CallbackQuery | undefined) => {
    if (!data) return
    const msg = data.message
    const command = data.data
    if (!msg || !command) {
        await sendMessage(MZBOT_BOT_TOKEN, {
            chat_id: data.from.id,
            text: 'the message/data is unavailable',
        })
        return
    }
    const args = command.split(/\s+/)
    const cmd = args.shift()!
    const reply = await execute(cmd, args, msg)
    await answerCallbackQuery(MZBOT_BOT_TOKEN, {
        callback_query_id: data.id,
        text: reply,
    })
}

export const webhook = async (request: Request) => {
    const payload: Update = await request.json()
    await handleMsg(payload.message)
    await handleCallback(payload.callback_query)
    return new Response('ok', { status: 200 })
}
