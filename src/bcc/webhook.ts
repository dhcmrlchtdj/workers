import { Update, Message } from 'telegram-typings'
import { execute, telegram } from './bot_command'

const handleMsg = async (msg: Message | undefined) => {
    if (!msg || !msg.text || !msg.entities) return

    const command = telegram.extractCommand(msg)
    if (command !== undefined && command.cmd !== '/add') {
        await execute(command.cmd, command.arg, msg)
        return
    }

    const hashtags = msg.entities
        .filter((x) => x.type === 'hashtag')
        .map((entity) => msg.text!.substr(entity.offset, entity.length))
    if (hashtags.length > 0) {
        const tags = Array.from(new Set(hashtags))
        await execute('/add', tags.join(' '), msg)
    }
}

export const webhook = async (request: Request): Promise<Response> => {
    const payload: Update = await request.json()
    await Promise.all([
        handleMsg(payload.message),
        handleMsg(payload.edited_message),
        handleMsg(payload.channel_post),
        handleMsg(payload.edited_channel_post),
    ])
    return new Response('ok')
}
