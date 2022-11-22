// https://api.mailchannels.net/tx/v1/documentation
// https://developers.cloudflare.com/pages/platform/functions/plugins/mailchannels/

import { POST } from "../feccan.js"

type MailAddress = { email: string; name?: string }
type MailContent = { type: string; value: string }
type MailSendBody = {
	from: MailAddress
	personalizations: {
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
	}
	headers?: Record<string, string>
	reply_to?: MailAddress
	subject: string
	content: MailContent[]
}

export class MailChannels {
	private base: string
	private from: MailAddress
	private dkim: { domain: string; selector: string; privateKey: string }
	constructor(
		from: MailAddress,
		dkim: {
			domain: string
			selector: string
			privateKey: string
		},
	) {
		this.base = "https://api.mailchannels.net/tx/v1"
		this.from = from
		this.dkim = dkim
	}
	private async _send(mail: MailSendBody) {
		mail.personalizations.dkim_domain ??= this.dkim.domain
		mail.personalizations.dkim_selector ??= this.dkim.selector
		mail.personalizations.dkim_private_key ??= this.dkim.privateKey

		const api = this.base + "/send"
		const body = JSON.stringify(mail)
		const resp = await POST(api, body, {
			"content-type": "application/json",
		})
		return resp
	}
	async sendEmail(
		to: (MailAddress | string)[],
		subject: string,
		content: string,
	) {
		const mail = {
			from: this.from,
			personalizations: {
				to: to.map(buildMailAddress),
			},
			subject,
			content: [
				{
					type: "text/plain",
					value: content,
				},
			],
		}
		return this._send(mail)
	}
}

function buildMailAddress(email: MailAddress | string): MailAddress {
	return typeof email === "string" ? { email } : email
}
