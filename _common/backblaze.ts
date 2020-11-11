// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
// https://www.backblaze.com/b2/docs/s3_compatible_api.html
// https://github.com/mhart/aws4fetch/blob/master/src/main.js

import { createHash, createHMAC } from './crypto'
import { check } from './check_response'
import { format } from './format-date'

export const mimeOctetStream = 'application/octet-stream'

// https://github.com/aws/aws-sdk-js/blob/v2.789.0/lib/signers/v4.js#L191
const UNSIGNABLE_HEADERS = new Set([
    'authorization',
    'content-type',
    'content-length',
    'user-agent',
    'presigned-expires',
    'expect',
    'x-amzn-trace-id',
])

export class BackBlaze {
    private accessKeyId: string
    private secretAccessKey: string
    private region: string
    constructor(accessKeyId: string, secretAccessKey: string, region: string) {
        this.accessKeyId = accessKeyId
        this.secretAccessKey = secretAccessKey
        this.region = region
    }

    // https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
    async putObject(
        bucket: string,
        filename: string,
        file: ArrayBuffer,
        contentType: string = mimeOctetStream,
    ) {
        const host = `${bucket}.s3.${this.region}.backblazeb2.com`
        const url = `https://${host}/${filename}`

        const headers = await this.signV4(
            'PUT',
            '/' + filename,
            {
                host,
                'content-type': contentType,
            },
            file,
        )

        const resp = await fetch(url, {
            method: 'PUT',
            headers,
            body: file,
        })
        await check(resp)
        return resp
    }

    private async signV4(
        method: string,
        uri: string,
        headers: Record<string, string>,
        body: ArrayBuffer,
    ): Promise<Record<string, string>> {
        const date = new Date()
        const yyyymmdd = format(date, 'YYYYMMDD', true)

        const canonicalRequest = await this.getCanonicalRequest(
            method.toUpperCase(),
            uri,
            headers,
            body,
        )
        const stringToSign = [
            'AWS4-HMAC-SHA256',
            format(date, 'YYYYMMDDThhmmssZ', true),
            `${yyyymmdd}/${this.region}/s3/aws4_request`,
            canonicalRequest,
        ].join('\n')

        const signingKey = await this.getSigningKey(yyyymmdd)

        const signature = await HMAC_SHA256_HEX(signingKey, stringToSign)
        const credential = `${this.accessKeyId}/${yyyymmdd}/${this.region}/s3/aws4_request`
        const signedHeaders = this.getSignedHeaders(headers)

        const auth = `AWS4-HMAC-SHA256 Credential=${credential},SignedHeaders=${signedHeaders},Signature=${signature}`

        headers['authorization'] = auth
        headers['date'] = date.toUTCString()
        return headers
    }

    private async getSigningKey(yyyymmdd: string): Promise<ArrayBuffer> {
        const key = `AWS4${this.secretAccessKey}`
        const dateKey = await HMAC_SHA256(key, yyyymmdd)
        const regionKey = await HMAC_SHA256(dateKey, this.region)
        const serviceKey = await HMAC_SHA256(regionKey, 's3')
        const signingKey = await HMAC_SHA256(serviceKey, 'aws4_request')
        return signingKey
    }

    private getSignedHeaders(headers: Record<string, string>): string {
        return Object.keys(headers)
            .map((h) => h.toLowerCase())
            .filter((h) => !UNSIGNABLE_HEADERS.has(h))
            .sort()
            .join(';')
    }

    private async getCanonicalRequest(
        method: string,
        uri: string,
        headers: Record<string, string>,
        body: ArrayBuffer,
    ): Promise<string> {
        const canonicalQueryString = ''
        const canonicalHeaders = Object.entries(headers)
            .map(([key, value]) => `${key.toLowerCase()}:${value.trim()}`)
            .sort()
            .join('\n')
        const signedHeaders = this.getSignedHeaders(headers)
        const hashedPayload = await HASH_SHA256_HEX(body)
        const canonicalRequest = [
            method,
            uri,
            canonicalQueryString,
            canonicalHeaders,
            signedHeaders,
            hashedPayload,
        ].join('\n')

        return HASH_SHA256_HEX(canonicalRequest)
    }
}

///

async function HMAC_SHA256(
    key: string | ArrayBuffer,
    data: string | ArrayBuffer,
) {
    return createHMAC('SHA-256', key).update(data).digest()
}

async function HMAC_SHA256_HEX(
    key: string | ArrayBuffer,
    data: string | ArrayBuffer,
) {
    return createHMAC('SHA-256', key).update(data).digest('hex')
}

async function HASH_SHA256_HEX(data: string | ArrayBuffer) {
    return createHash('SHA-256').update(data).digest('hex')
}
