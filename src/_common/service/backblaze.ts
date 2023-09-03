// https://www.backblaze.com/b2/docs/s3_compatible_api.html

import * as S from "../http/request.ts"
import { addAws4SignatureHeader } from "./s3.ts"

export class BackBlaze {
	private accessKeyId: string
	private secretAccessKey: string
	private region: string
	private bucket: string
	constructor(
		accessKeyId: string,
		secretAccessKey: string,
		region: string,
		bucket: string,
	) {
		this.accessKeyId = accessKeyId
		this.secretAccessKey = secretAccessKey
		this.region = region
		this.bucket = bucket
	}

	// https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
	async putObject(filename: string, file: ArrayBuffer, contentType: string) {
		const host = `${this.bucket}.s3.${this.region}.backblazeb2.com`
		const url = `https://${host}/${filename}`

		const req = await addAws4SignatureHeader(
			S.build(
				S.put(url),
				S.body(file),
				S.header("host", host),
				S.contentType(contentType),
			),
			{
				service: "s3",
				region: this.region,
				accessKeyId: this.accessKeyId,
				secretAccessKey: this.secretAccessKey,
			},
		)

		const resp = await fetch(req)
		if (!resp.ok) throw resp
	}
}
