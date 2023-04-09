import { encodeHtmlEntities, Telegram } from "./telegram.js"

export class TelegramMonitor {
	private _serviceName: string
	private _chatId: number | undefined
	private _telegram: Telegram | undefined
	constructor(
		serviceName: string,
		token: string | undefined,
		chatId: number | undefined,
	) {
		this._serviceName = serviceName
		this._chatId = chatId
		this._telegram = token ? new Telegram(token) : undefined
	}

	error(err: unknown, req?: Request): Promise<void> {
		return this._log("error", err, req)
	}

	warn(err: unknown, req?: Request): Promise<void> {
		return this._log("warn", err, req)
	}

	async logResponse(resp: Response, req?: Request): Promise<void> {
		let body: string = ""
		try {
			body = await resp.clone().text()
		} catch (e) {
			body = String(e)
		}
		const err = new Error(
			JSON.stringify({
				status: resp.status,
				body,
			}),
		)
		return this._log("warn", err, req)
	}

	private _log(
		level: string,
		error: unknown,
		req: Request | undefined,
	): Promise<void> {
		const message: Record<string, unknown> = {
			time: new Date().toISOString(),
			level,
			service: this._serviceName,
			request: parseRequest(req),
			error: error instanceof Error ? error.stack?.split(/\n +/) : error,
		}
		return this._send(message)
	}

	private async _send(message: Record<string, unknown>): Promise<void> {
		const msg = JSON.stringify(message, null, 4)
		console.log(msg)
		await this._telegram?.send("sendMessage", {
			chat_id: Number(this._chatId),
			text: `<pre>${encodeHtmlEntities(msg)}</pre>`,
			parse_mode: "HTML",
			disable_web_page_preview: true,
			disable_notification: true,
		})
	}
}

function parseRequest(req: Request | undefined) {
	if (req === undefined) return undefined
	return {
		url: req.url,
		method: req.method,
		headers: headerToRecord(req.headers),
	}
}

function headerToRecord(headers: Headers): Record<string, string> {
	const h: Record<string, string> = {}
	for (const [key, val] of headers.entries()) {
		h[key] = val
	}
	return h
}
