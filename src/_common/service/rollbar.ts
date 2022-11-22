// https://gist.github.com/dukejones/d160a1b2051ff7c1a485bdcf966f1bcc
// https://explorer.docs.rollbar.com/#operation/create-item
// https://github.com/rollbar/rollbar.js
// https://github.com/stacktracejs/error-stack-parser

import { POST } from "../feccan.js"

type Level = "critical" | "error" | "warning" | "info" | "debug"

export class Rollbar {
	token: string
	project: string
	constructor(token: string, project: string) {
		this.token = token
		this.project = project
	}

	private send(
		level: Level,
		body: Record<string, unknown>,
	): Promise<Response> {
		const msg = JSON.stringify({
			data: {
				environment: "production",
				level,
				timestamp: (Date.now() / 1000) | 0,
				platform: "cloudflare-worker",
				language: "javascript",
				uuid: crypto.randomUUID(),
				context: this.project,
				...body,
			},
		})
		console.log(msg)
		return POST("https://api.rollbar.com/api/1/item/", msg, {
			"X-Rollbar-Access-Token": this.token,
		})
	}

	private log(level: Level, error: unknown, req: Request | undefined) {
		if (error instanceof Error) {
			const body = {
				title: `${error.name}: ${error.message}`,
				body: {
					trace_chain: errorToTraceChain(error),
				},
				request: parseRequest(req),
			}
			return this.send(level, body)
		} else {
			const body = {
				title: `${error}`,
				body: {
					message: {
						body: `${error}`,
					},
				},
				request: parseRequest(req),
			}
			return this.send(level, body)
		}
	}

	async error(err: unknown, req?: Request): Promise<void> {
		await this.log("error", err, req)
	}

	async warn(err: unknown, req?: Request): Promise<void> {
		await this.log("warning", err, req)
	}
}

function parseRequest(req: Request | undefined) {
	if (req === undefined) return undefined
	const url = new URL(req.url)
	const parsed = {
		url: `${url.protocol}//${url.hostname}${url.pathname}`,
		method: req.method,
		headers: (() => {
			const h: Record<string, string> = {}
			for (const [key, val] of req.headers.entries()) {
				h[key] = val
			}
			return h
		})(),
		query_string: url.search,
		user_ip: req.headers.get("CF-Connecting-IP"),
	}
	return parsed
}

function parseError(error: Error) {
	if (typeof error.stack !== "string") return []
	const stacks = error.stack
		.split("\n")
		.filter((line) => line.match(/^\s*at .*(\S+:\d+|\(native\))/m))
		.map((line) => line.replace(/^\s+/, ""))
		.map((line) => {
			const loc = line.match(/ (\((.+):(\d+):(\d+)\)$)/)
			if (loc) line = line.replace(loc[0]!, "")
			const tokens = line.split(/\s+/).slice(1)
			const method = tokens.join(" ") || undefined
			const locationParts = ((urlLike: string) => {
				if (urlLike.includes(":")) {
					return [urlLike]
				}
				const regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/
				const parts = regExp.exec(urlLike.replace(/[()]/g, ""))!
				return [parts[1], parts[2], parts[3]]
			})(loc ? loc[1]! : tokens.pop()!)
			return {
				method,
				lineno: locationParts[1],
				colno: locationParts[2],
				filename: locationParts[0],
			}
		})
	return stacks
}

function errorToTraceChain(error: unknown) {
	const errorChain = []
	let err: unknown = error
	while (err instanceof Error) {
		errorChain.push(err)
		err = err.cause
	}
	if (err) {
		errorChain.push(new Error(err as string))
	}

	const traceChain = errorChain.map((err) => ({
		exception: {
			class: err.name,
			message: err.message,
		},
		frames: parseError(err),
	}))

	return traceChain
}
