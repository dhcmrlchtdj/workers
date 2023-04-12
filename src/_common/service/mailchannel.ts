// https://api.mailchannels.net/tx/v1/documentation
// https://developers.cloudflare.com/pages/platform/functions/plugins/mailchannels/

import * as S from "../http/request.js"

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
	personalizations: MailPersonalization[]
	headers?: Record<string, string>
	reply_to?: MailAddress
}

export async function sendEmail(
	mailContent: MailChannelsSendBody,
	api = "https://api.mailchannels.net/tx/v1/send",
) {
	const resp = await fetch(S.build(S.post(api), S.json(mailContent)))
	if (!resp.ok) throw resp
	return resp
}
