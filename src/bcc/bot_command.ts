import { Message } from "telegram-typings"
import { Database } from "../_common/service/database"
import { Telegram } from "../_common/service/telegram"

declare const BCC_BOT_TOKEN: string
declare const DB_API: string
declare const DB_TOKEN: string

export const telegram = new Telegram(BCC_BOT_TOKEN, "blind_carbon_copy_bot")
const database = new Database(DB_API, DB_TOKEN)
const actions = new Map<string, (arg: string, msg: Message) => Promise<void>>()

actions.set("/whoami", async (_arg: string, msg: Message) => {
    const chat_id = msg.chat.id
    const text = JSON.stringify(
        {
            chat_id,
            ...(msg.from ?? {}),
        },
        null,
        4,
    )
    await telegram.send("sendMessage", {
        chat_id,
        text,
        reply_to_message_id: msg.message_id,
    })
})

const modifyTags = async (sql: string, arg: string, msg: Message) => {
    const tag = arg.trim()
    if (tag.length < 1) return
    const tags = tag.split(/\s+/)
    if (tags.length < 1) return
    await database.raw(sql, msg.chat.id, tags)
}

actions.set("/add", async (arg: string, msg: Message) => {
    const sql = `
        WITH t(tags) AS (
            SELECT ARRAY(
                SELECT UNNEST($2::TEXT[])
                UNION
                SELECT UNNEST(tags) FROM bcc WHERE chat_id=$1
            )
        )
        INSERT INTO bcc(chat_id, tags) SELECT $1, tags FROM t
        ON CONFLICT(chat_id)
        DO UPDATE SET tags = EXCLUDED.tags
    `
    await modifyTags(sql, arg, msg)
})

actions.set("/remove", async (arg: string, msg: Message) => {
    const sql = `
        WITH t(tags) AS (
            SELECT ARRAY(
                SELECT UNNEST(tags) FROM bcc WHERE chat_id=$1
                EXCEPT
                SELECT UNNEST($2::TEXT[])
            )
        )
        UPDATE bcc SET tags = t.tags FROM t WHERE bcc.chat_id=$1
    `
    await modifyTags(sql, arg, msg)
})

const getTagList = async (chatId: Number): Promise<string | "not found"> => {
    const arr = await database.queryOne<Array<string[]>>(
        "SELECT to_jsonb(tags) FROM bcc WHERE chat_id=$1",
        chatId,
    )
    if (arr === null) {
        return "not found"
    } else {
        const tags = arr[0]!.sort()
        const text = tags.reduce(
            (prev: { tag: string; text: string }, curr: string) => {
                if (prev.tag[1] === curr[1]) {
                    prev.text += " " + curr
                } else {
                    prev.text += "\n" + curr
                    prev.tag = curr
                }
                return prev
            },
            { tag: "", text: "" },
        )
        return text.text
    }
}

actions.set("/list", async (_arg: string, msg: Message) => {
    const chat_id = msg.chat.id
    const tagList = await getTagList(chat_id)
    await telegram.send("sendMessage", { chat_id, text: tagList })
})

actions.set("/update", async (_arg: string, msg: Message) => {
    const replied = msg.reply_to_message
    if (!replied) return

    if (msg.chat.type !== "channel") {
        if (!telegram.sentByMe(replied)) return
    }

    const chat_id = msg.chat.id
    const tagList = await getTagList(chat_id)
    if (replied.text === tagList) return

    if (msg.chat.type === "channel") {
        await telegram.send("sendMessage", {
            chat_id,
            text: `backup\n${replied.text}`,
        })
    }

    await telegram.send("editMessageText", {
        chat_id,
        message_id: replied.message_id,
        text: tagList,
    })
})

export const execute = async (cmd: string, arg: string, msg: Message) => {
    const isAdmin = await telegram.fromAdmin(msg)
    if (!isAdmin) return
    const act = actions.get(cmd)
    if (act !== undefined) {
        await act(arg, msg)
    }
}
