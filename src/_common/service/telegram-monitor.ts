import { encodeHtmlEntities, telegram } from "./telegram.js"

export class TelegramMonitor {
	private _serviceName: string
	private _chatId: number | undefined
	private _token: string | undefined
	constructor(
		serviceName: string,
		token: string | undefined,
		chatId: number | undefined,
	) {
		this._serviceName = serviceName
		this._chatId = chatId
		this._token = token
	}

	error(err: unknown, req?: Request): Promise<void> {
		return this._log(err, req)
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
		return this._log(err, req)
	}

	private _log(error: unknown, req: Request | undefined): Promise<void> {
		const message: Record<string, unknown> = {
			time: new Date().toISOString(),
			service: this._serviceName,
			request: parseRequest(req),
			error: error instanceof Error ? error.stack?.split(/\n +/) : error,
		}
		return this._send(message)
	}

	private async _send(message: Record<string, unknown>): Promise<void> {
		if (this._token !== undefined && this._chatId !== undefined) {
			const msg = JSON.stringify(message, null, 4)
			const sendMessage = telegram(this._token, "sendMessage")
			await sendMessage({
				chat_id: Number(this._chatId),
				text: `<pre>${encodeHtmlEntities(msg)}</pre>`,
				parse_mode: "HTML",
				disable_web_page_preview: true,
				disable_notification: true,
			})
		}
	}
}

function parseRequest(req: Request | undefined) {
	if (req) {
		return {
			url: req.url,
			method: req.method,
			headers: headerToRecord(req.headers),
		}
	}
	return undefined
}

function headerToRecord(headers: Headers): Record<string, string> {
	const h: Record<string, string> = {}
	for (const [key, val] of headers.entries()) {
		h[key] = val
	}
	return h
}
