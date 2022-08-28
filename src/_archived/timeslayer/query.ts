import { Database } from "../_common/service/database"

declare const DB_API: string
declare const DB_TOKEN: string

const database = new Database(DB_API, DB_TOKEN)

export type scoreLog = {
	createdAt: Date
	score: number
	reason: string
}

export const getScore = async (chatId: number): Promise<number> => {
	const sql = `SELECT COALESCE(SUM(score), 0) FROM credit WHERE chatId=$1`
	const score = await database.queryOne<number>(sql, chatId)
	return score ?? 0
}

export const addScore = async (
	chatId: number,
	messageId: number,
	score: number,
	reason: string,
): Promise<void> => {
	const sql = `
        INSERT INTO credit(chatId, messageId, score, reason)
        VALUES ($1, $2, $3, $4)
    `
	await database.raw(sql, chatId, messageId, score, reason)
}

export const updateScore = async (
	chatId: number,
	messageId: number,
	score: number,
	reason: string,
): Promise<void> => {
	const sql = `
        UPDATE credit SET score=$3, reason=$4
        WHERE chatId=$1 AND messageId=$2
    `
	await database.raw(sql, chatId, messageId, score, reason)
}

export const deleteScore = async (
	chatId: number,
	messageId: number,
): Promise<null | scoreLog> => {
	const sql = `
        DELETE FROM credit WHERE chatId=$1 AND messageId=$2
        RETURNING createdAt, score, reason
    `
	const log = await database.queryOne<[string, number, string]>(
		sql,
		chatId,
		messageId,
	)
	if (log === null) return null
	return { createdAt: new Date(log[0]), score: log[1], reason: log[2] }
}

export const getHistory = async (
	chatId: number,
	limit: number,
): Promise<Array<scoreLog>> => {
	const sql = `
        SELECT createdAt, score, reason
        FROM credit
        WHERE chatId=$1
        ORDER BY createdAt DESC
        LIMIT $2
    `
	const log = await database.query<[string, number, string]>(
		sql,
		chatId,
		limit,
	)
	return log.map(([createdAt, score, reason]) => ({
		createdAt: new Date(createdAt),
		score,
		reason,
	}))
}
