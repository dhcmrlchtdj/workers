// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
// https://www.backblaze.com/b2/docs/s3_compatible_api.html
// https://github.com/mhart/aws4fetch/blob/master/src/main.js

import { createHash, createHMAC } from '../crypto'
import { check } from '../check_response'
import { format } from '../format-date'

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
        contentType: string,
    ) {
        const host = `${bucket}.s3.${this.region}.backblazeb2.com`
        const url = `https://${host}/${filename}`

        const headers = await this.signAWS4(
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

    private async signAWS4(
        method: string,
        uri: string,
        headers: Record<string, string>,
        body: ArrayBuffer,
    ): Promise<Record<string, string>> {
        const encodedUri = uriEncode(uri)

        const d = new Date()
        const date = format(d, 'YYYYMMDD', true)
        const datetime = format(d, 'YYYYMMDDThhmmssZ', true)

        const service = `${date}/${this.region}/s3/aws4_request`

        const hashedPayload = await HASH_SHA256_HEX(body)

        headers['x-amz-date'] = datetime
        headers['x-amz-content-sha256'] = hashedPayload

        const headerKeys = Object.keys(headers)
            .map((h) => h.toLowerCase())
            .filter((h) => !UNSIGNABLE_HEADERS.has(h))
            .sort()

        const canonicalRequest = await this.getCanonicalRequest(
            method.toUpperCase(),
            encodedUri,
            headerKeys,
            headers,
            hashedPayload,
        )
        const stringToSign = [
            'AWS4-HMAC-SHA256',
            datetime,
            service,
            canonicalRequest,
        ].join('\n')

        const signingKey = await this.getSigningKey(date)

        const signature = await HMAC_SHA256_HEX(signingKey, stringToSign)
        const credential = `${this.accessKeyId}/${service}`
        const signedHeaders = headerKeys.join(';')

        const auth = `AWS4-HMAC-SHA256 Credential=${credential},SignedHeaders=${signedHeaders},Signature=${signature}`
        headers['authorization'] = auth

        return headers
    }

    private async getSigningKey(date: string): Promise<ArrayBuffer> {
        const key = `AWS4${this.secretAccessKey}`
        const dateKey = await HMAC_SHA256(key, date)
        const regionKey = await HMAC_SHA256(dateKey, this.region)
        const serviceKey = await HMAC_SHA256(regionKey, 's3')
        const signingKey = await HMAC_SHA256(serviceKey, 'aws4_request')
        return signingKey
    }

    private async getCanonicalRequest(
        method: string,
        uri: string,
        headerKeys: string[],
        headers: Record<string, string>,
        hashedPayload: string,
    ): Promise<string> {
        const canonicalQueryString = ''
        // https://github.com/aws/aws-sdk-js/blob/v2.789.0/lib/signers/v4.js#L155
        const canonicalHeaders =
            headerKeys
                .map((k) => `${k}:${headers[k]!.trim().replace(/\s+/g, ' ')}`)
                .join('\n') + '\n'
        const signedHeaders = headerKeys.join(';')
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

// https://github.com/aws/aws-sdk-js/blob/v2.789.0/lib/util.js#L51
// https://github.com/mhart/aws4fetch/blob/v1.0.13/src/main.js#L367
const uriEncode = (input: string): string => {
    let output = encodeURIComponent(input)
        .replace(/%2f/gi, '/')
        .replace(
            /[!'()*]/g,
            (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
        )
    return output
}

async function HMAC_SHA256(key: string | ArrayBuffer, data: string) {
    return createHMAC('SHA-256', key).update(data).digest()
}

async function HMAC_SHA256_HEX(key: ArrayBuffer, data: string) {
    return createHMAC('SHA-256', key).update(data).digest('hex')
}

async function HASH_SHA256_HEX(data: string | ArrayBuffer) {
    return createHash('SHA-256').update(data).digest('hex')
}
