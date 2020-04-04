import { Update, Message } from 'telegram-typings'
import { execute } from './bot_command'
import { FaunaClient } from '../_common/fauna'

const handleMsg = async (msg: Message | undefined) => {
    if (!msg || !msg.text || !msg.entities) return

    const text = msg.text
    const entities: [string, string][] = msg.entities.map((entity) => [
        entity.type,
        text.substr(entity.offset, entity.length),
    ])

    const hashtags = entities
        .filter(([type, _]) => type === 'hashtag')
        .map(([_, tag]) => tag)
    if (hashtags.length > 0) {
        const tags = Array.from(new Set(hashtags))
        await execute('add_tags', tags, msg)
    }

    const commands = entities
        .filter(([type, _]) => type === 'bot_command')
        .map(([_, command]) => {
            const args = command.split(/\s+/)
            let cmd = args.shift()!
            cmd = cmd.split('@')[0]
            return execute(cmd, args, msg)
        })
    if (commands.length > 0) {
        await Promise.all(commands)
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
