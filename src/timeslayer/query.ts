import { Database } from "../_common/service/database"

declare const DB_API: string
declare const DB_TOKEN: string

const database = new Database(DB_API, DB_TOKEN)

export const getScore = async (chatId: number): Promise<number> => {
    const sql = `SELECT COALESCE(SUM(score), 0) FROM credit WHERE chat_id=$1`
    const score = await database.queryOne<number>(sql, chatId)
    return score ?? 0
}

export const addScore = async (
    chatId: number,
    score: number,
    reason: string,
): Promise<void> => {
    const sql = `INSERT INTO credit(chat_id, score, reason) VALUES ($1, $2, $3)`
    await database.raw(sql, chatId, score, reason)
}

export const getHistory = async (
    chatId: number,
    limit: number,
): Promise<Array<{ time: string; score: number; reason: string }>> => {
    const sql = `
        SELECT created_at, score, reason
        FROM credit
        WHERE chat_id=$1
        ORDER BY created_at DESC
        LIMIT $2
    `
    const log = await database.query<[string, number, string]>(
        sql,
        chatId,
        limit,
    )
    return log.map(([time, score, reason]) => ({ time, score, reason }))
}
