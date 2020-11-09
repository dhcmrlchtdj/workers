// https://www.backblaze.com/b2/docs/calling.html

import { encode } from './base64'
import { createHash } from './crypto'
import { check } from './check_response'

export class BackBlaze {
    private keyId: string
    private key: string
    private auth: Authorize | null
    constructor(keyId: string, key: string) {
        this.keyId = keyId
        this.key = key
        this.auth = null
    }

    private async authorize(): Promise<void> {
        const ba = encode(this.keyId + ':' + this.key)
        const resp = await fetch(
            'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
            { headers: { authorization: 'Basic ' + ba } },
        )
        await check(resp)
        this.auth = await resp.json()
    }

    private async getUploadUrl(bucketId: string): Promise<GetUploadUrl> {
        const resp = await fetch(
            this.auth!.apiUrl + '/b2api/v2/b2_get_upload_url',
            {
                method: 'POST',
                headers: { authorization: this.auth!.authorizationToken },
                body: JSON.stringify({ bucketId }),
            },
        )
        await check(resp)
        return resp.json()
    }

    async upload(bucketId: string, filename: string, file: ArrayBuffer) {
        await this.authorize()
        const UploadUrl = await this.getUploadUrl(bucketId)

        const resp = await fetch(UploadUrl.uploadUrl, {
            method: 'POST',
            headers: {
                Authorization: UploadUrl.authorizationToken,
                'Content-Type': 'application/octet-stream',
                'Content-Length': String(file.byteLength),
                'X-Bz-File-Name': filename,
                'X-Bz-Content-Sha1': await createHash('SHA-1')
                    .update(file)
                    .digest('hex'),
            },
            body: file,
        })
        await check(resp)
    }
}

type Authorize = {
    absoluteMinimumPartSize: number
    recommendedPartSize: number
    allowed: {
        capabilities: string[]
        bucketId: string | null
        bucketName: string | null
        namePrefix: null
    }
    accountId: string
    apiUrl: string
    authorizationToken: string
    downloadUrl: string
}

type GetUploadUrl = {
    authorizationToken: string
    bucketId: string
    uploadUrl: string
}
