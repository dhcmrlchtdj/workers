// https://api.mailchannels.net/tx/v1/documentation
// https://developers.cloudflare.com/pages/platform/functions/plugins/mailchannels/

import { POST } from "../http-client.js"

type MailAddress = { email: string; name?: string }
type MailContent = { type: "text/plain"; value: string }
type MailSendBody = {
	subject: string
	content: MailContent[]
	from: MailAddress
	personalizations: [
		{
			to: MailAddress[]
			cc?: MailAddress[]
			bcc?: MailAddress[]
			dkim_domain?: string
			dkim_private_key?: string
			dkim_selector?: string
			from?: MailAddress
			headers?: Record<string, string>
			reply_to?: MailAddress
			subject?: string
		},
	]
	headers?: Record<string, string>
	reply_to?: MailAddress
}

export class MailChannels {
	private base: string
	private from: MailAddress
	private dkim: {
		dkim_domain: string
		dkim_selector: string
		dkim_private_key: string
	}
	constructor(
		from: MailAddress,
		dkim: {
			dkim_domain: string
			dkim_private_key: string
			dkim_selector: string
		},
	) {
		this.base = "https://api.mailchannels.net/tx/v1"
		this.from = from
		this.dkim = dkim
	}

	async sendEmail(
		to: (MailAddress | string)[],
		subject: string,
		content: string,
	) {
		const mail: MailSendBody = {
			from: this.from,
			personalizations: [
				{
					...this.dkim,
					to: to.map(buildMailAddress),
				},
			],
			subject,
			content: [
				{
					type: "text/plain",
					value: content,
				},
			],
		}

		const api = this.base + "/send?dry-run"
		const body = JSON.stringify(mail)
		const resp = await POST(api, body, {
			accept: "application/json",
			"content-type": "application/json",
		})
		return resp
	}
}

function buildMailAddress(email: MailAddress | string): MailAddress {
	return typeof email === "string" ? { email } : email
}
