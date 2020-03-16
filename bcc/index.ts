import {} from '@cloudflare/workers-types'
import { Update, Message } from 'telegram-typings'
import { dispatch } from './command'
import * as data from './data'

// from worker environment
declare const BCC_WEBHOOK_PATH: string

// ---

addEventListener('fetch', event => {
    event.respondWith(handle(event.request))
})

async function handle(request: Request) {
    const url = new URL(request.url)
    switch (url.pathname) {
        case `/webhook/telegram/bcc/${BCC_WEBHOOK_PATH}`:
            return bcc(request)
        default:
            return new Response(null, { status: 404 })
    }
}

const collectTag = async (msg: Message) => {
    const text = msg.text!
    const entries = msg.entities!
    const tags = entries
        .filter(entry => entry.type === 'hashtag')
        .map(entry => text.substr(entry.offset, entry.length))
    if (tags.length <= 0) return
    const chatId = msg.chat.id
    try {
        await data.addTags(chatId, Array.from(new Set(tags)))
    } catch (err) {
        console.error(err)
    }
}

const dispatchCommands = (msg: Message) => {
    const text = msg.text!
    const entries = msg.entities!
    entries
        .filter(entry => entry.type === 'bot_command')
        .map(entry => text.substr(entry.offset, entry.length))
        .forEach(command => {
            const args = command.split(/\s+/)
            let cmd = args.shift()!
            cmd = cmd.split('@')[0]
            dispatch(cmd, args, msg)
        })
}

async function bcc(request: Request) {
    if (request.method !== 'POST') new Response(null, { status: 405 })
    const payload: Update = await request.json()
    const aux = (msg: Message | undefined) => {
        if (!msg) return
        const entries = msg.entities
        if (!Array.isArray(entries)) return
        collectTag(msg)
        dispatchCommands(msg)
    }
    aux(payload.message)
    aux(payload.edited_message)
    aux(payload.channel_post)
    aux(payload.edited_channel_post)
    return new Response('ok', { status: 200 })
}
