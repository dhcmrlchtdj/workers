import {} from '@cloudflare/workers-types'
import { Update, Message } from 'telegram-typings'
import { execute } from './command'
import * as db from './db'
import { sentry } from './sentry'

// from worker environment
declare const BCC_FAUNA_KEY: string
declare const BCC_WEBHOOK_PATH: string
declare const BCC_BOT_TOKEN: string
declare const SENTRY_KEY: string

addEventListener('fetch', async event => {
    let resp: Response
    try {
        resp = await handle(event.request)
    } catch (err) {
        event.waitUntil(sentry('bcc', event.request, err))
        const msg = `${err}\n${err.stack}`
        resp = new Response(msg, { status: 200 })
    }
    event.respondWith(resp)
})

async function handle(request: Request) {
    const url = new URL(request.url)
    switch (url.pathname) {
        case `/webhook/telegram/bcc/${BCC_WEBHOOK_PATH}`:
            if (request.method.toUpperCase() === 'POST') {
                return webhook(request)
            } else {
                return new Response('405', { status: 200 })
            }
        default:
            return new Response('404', { status: 200 })
    }
}

const handleMsg = async (msg: Message | undefined) => {
    if (!msg || !msg.text || !msg.entities) return
    const text = msg.text
    const entities: [string, string][] = msg.entities.map(entity => [
        entity.type,
        text.substr(entity.offset, entity.length),
    ])

    const hashtags = entities
        .filter(([type, _]) => type === 'hashtag')
        .map(([_, tag]) => tag)
    if (hashtags.length > 0) {
        await db.addTags(msg.chat.id, Array.from(new Set(hashtags)))
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

async function webhook(request: Request) {
    const payload: Update = await request.json()
    await Promise.all([
        handleMsg(payload.message),
        handleMsg(payload.edited_message),
        handleMsg(payload.channel_post),
        handleMsg(payload.edited_channel_post),
    ])
    return new Response('ok', { status: 200 })
}