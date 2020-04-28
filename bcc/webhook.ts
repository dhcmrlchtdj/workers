import { Update, Message } from 'telegram-typings'
import { extractCommands } from '../_common/telegram'
import { execute } from './bot_command'

const handleMsg = async (msg: Message | undefined) => {
    if (!msg || !msg.text || !msg.entities) return

    const hashtags = msg.entities
        .filter((x) => x.type === 'hashtag')
        .map((entity) => msg.text!.substr(entity.offset, entity.length))
    if (hashtags.length > 0) {
        const tags = Array.from(new Set(hashtags))
        await execute('/add_tags', tags.join(' '), msg)
    }

    const commands = extractCommands(msg, 'blind_carbon_copy_bot')
    if (commands.length > 0) {
        await Promise.all(commands.map((c) => execute(c.cmd, c.arg, msg)))
    }
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
