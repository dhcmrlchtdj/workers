// https://api.mailchannels.net/tx/v1/documentation
// https://developers.cloudflare.com/pages/platform/functions/plugins/mailchannels/

import { POST } from "../http-client.js"

type MailAddress = { email: string; name?: string }
type MailContent = { type: string; value: string }
type MailPersonalization = {
	to: [MailAddress, ...MailAddress[]]
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
export type MailChannelsSendBody = {
	subject: string
	content: [MailContent, ...MailContent[]]
	from: MailAddress
	personalizations: [MailPersonalization, ...MailPersonalization[]]
	headers?: Record<string, string>
	reply_to?: MailAddress
}

export class MailChannels {
	private base: string
	private dkim: {
		dkim_domain: string
		dkim_selector: string
		dkim_private_key: string
	}
	constructor(dkim: {
		dkim_domain: string
		dkim_private_key: string
		dkim_selector: string
	}) {
		this.base = "https://api.mailchannels.net/tx/v1"
		this.dkim = dkim
	}

	async sendEmail(mailContent: MailChannelsSendBody) {
		mailContent.personalizations = mailContent.personalizations.map((t) => {
			return {
				...this.dkim,
				...t,
			}
		}) as [MailPersonalization, ...MailPersonalization[]]
		const api = this.base + "/send"
		const body = JSON.stringify(mailContent)
		const resp = await POST(api, body, {
			"content-type": "application/json",
		})
		if (!resp.ok) throw resp
		return resp
	}
}
