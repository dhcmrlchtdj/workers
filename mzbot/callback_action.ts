import { Message } from 'telegram-typings'
import { sendPhoto } from '../_common/telegram'

declare const MZBOT_BOT_TOKEN: string

const actions = new Map<
    string,
    (args: string[], msg: Message) => Promise<string>
>()

actions.set('post_photo', async (chatId: string[], msg: Message) => {
    if (!msg.photo) return 'post_photo | empty photo'
    const photo = msg.photo.reduce((x, y) => {
        if (x.width * x.height >= y.width * y.height) {
            return x
        } else {
            return y
        }
    })
    await sendPhoto(MZBOT_BOT_TOKEN, {
        chat_id: Number(chatId[0]),
        photo: photo.file_id,
    })
    return 'post_photo | done'
})

export const execute = (cmd: string, args: string[], msg: Message) => {
    const act = actions.get(cmd)
    if (act !== undefined) {
        return act(args, msg)
    } else {
        return 'unknown action'
    }
}
