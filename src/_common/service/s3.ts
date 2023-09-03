// https://github.com/mhart/aws4fetch/blob/master/src/main.js
// https://github.com/aws/aws-sdk-js/blob/master/lib/signers/v4.js
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html

import { createHash } from "../crypto/hash.ts"
import { createHMAC } from "../crypto/hmac.ts"
import { format } from "../format-date.ts"

type AWSConfig = {
	service: "s3"
	region: string
	accessKeyId: string
	secretAccessKey: string
}

export async function createAws4SignedUrl(
	req: Request,
	aws: AWSConfig,
): Promise<URL> {
	const d = new Date()
	const date = format(d, "YYYYMMDD")
	const datetime = format(d, "YYYYMMDDThhmmssZ")

	const method = req.method.toUpperCase()
	const url = new URL(req.url)
	const query = url.searchParams
	const header = req.headers

	query.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	query.set("X-Amz-Date", datetime)
	if (aws.service === "s3" && !query.has("X-Amz-Expires")) {
		query.set("X-Amz-Expires", "86400")
	}

	const signedHeaders = getSignedHeaders(header)
	query.set("X-Amz-SignedHeaders", signedHeaders.join(";"))

	const scope = `${date}/${aws.region}/${aws.service}/aws4_request`
	const credential = `${aws.accessKeyId}/${scope}`
	query.set("X-Amz-Credential", credential)

	const signature = await getSignature(
		method,
		url.pathname,
		query,
		header,
		signedHeaders,
		"UNSIGNED-PAYLOAD",
		date,
		datetime,
		scope,
		aws,
	)
	query.set("X-Amz-Signature", signature)

	return url
}

export async function addAws4SignatureHeader(
	req: Request,
	aws: AWSConfig,
): Promise<Request> {
	const d = new Date()
	const date = format(d, "YYYYMMDD")
	const datetime = format(d, "YYYYMMDDThhmmssZ")

	const method = req.method.toUpperCase()
	const url = new URL(req.url)
	const header = req.headers

	header.set("x-amz-date", datetime)

	const body = await req.clone().arrayBuffer()
	const hashedPayload = await HASH_SHA256_HEX(body)
	header.set("x-amz-content-sha256", hashedPayload)

	const scope = `${date}/${aws.region}/${aws.service}/aws4_request`

	const signedHeaders = getSignedHeaders(header)

	const signature = await getSignature(
		method,
		url.pathname,
		url.searchParams,
		header,
		signedHeaders,
		hashedPayload,
		date,
		datetime,
		scope,
		aws,
	)
	const auth = [
		`AWS4-HMAC-SHA256 Credential=${aws.accessKeyId}/${scope}`,
		`SignedHeaders=${signedHeaders.join(";")}`,
		`Signature=${signature}`,
	].join(",")
	header.set("authorization", auth)

	return req
}

///

async function getSignature(
	method: string,
	pathname: string,
	query: URLSearchParams,
	header: Headers,
	signedHeaders: string[],
	payload: string,
	date: string,
	datetime: string,
	scope: string,
	aws: AWSConfig,
) {
	const canonicalRequest = await getCanonicalRequest(
		method,
		pathname,
		query,
		header,
		signedHeaders,
		payload,
	)

	const stringToSign = [
		"AWS4-HMAC-SHA256",
		datetime,
		scope,
		canonicalRequest,
	].join("\n")

	const signingKey = await getSigningKey(date, aws)
	const signature = await HMAC_SHA256_HEX(signingKey, stringToSign)

	return signature
}

async function getSigningKey(
	date: string,
	aws: AWSConfig,
): Promise<ArrayBuffer> {
	const key = `AWS4${aws.secretAccessKey}`
	const dateKey = await HMAC_SHA256(key, date)
	const regionKey = await HMAC_SHA256(dateKey, aws.region)
	const serviceKey = await HMAC_SHA256(regionKey, aws.service)
	const signingKey = await HMAC_SHA256(serviceKey, "aws4_request")
	return signingKey
}

function getCanonicalRequest(
	method: string,
	pathname: string,
	query: URLSearchParams,
	header: Headers,
	headerKeys: string[],
	hashedPayload: string,
): Promise<string> {
	const canonicalQueryString = Array.from(query.keys())
		.sort()
		.map((k) =>
			query
				.getAll(k)
				.sort()
				.map((v) => uriEncode(k) + "=" + uriEncode(v)),
		)
		.flat()
		.join("&")

	// https://github.com/aws/aws-sdk-js/blob/v2.789.0/lib/signers/v4.js#L155
	const canonicalHeaders = headerKeys
		.map((k) => `${k}:${header.get(k)!.trim().replace(/\s+/g, " ")}`)
		.join("\n")

	const signedHeaders = headerKeys.join(";")
	const canonicalRequest = [
		method,
		uriEncode(pathname).replaceAll("%2F", "/"),
		canonicalQueryString,
		canonicalHeaders,
		"",
		signedHeaders,
		hashedPayload,
	].join("\n")

	return HASH_SHA256_HEX(canonicalRequest)
}

// https://github.com/aws/aws-sdk-js/blob/v2.1390.0/lib/signers/v4.js#L191
const UNSIGNABLE_HEADERS = new Set([
	"authorization",
	"content-type",
	"content-length",
	"user-agent",
	"presigned-expires",
	"expect",
	"x-amzn-trace-id",
])

function getSignedHeaders(header: Headers): string[] {
	const signedHeaders = Array.from(header.keys())
		.map((h) => h.toLowerCase())
		.filter((h) => !UNSIGNABLE_HEADERS.has(h))
		.sort()
	return signedHeaders
}

///

const uriEncode = (input: string): string => {
	return encodeURIComponent(input).replace(
		/[!*'()]/g,
		(c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
	)
}

async function HMAC_SHA256(key: string | ArrayBuffer, data: string) {
	return createHMAC("SHA-256", key).update(data).digest()
}

async function HMAC_SHA256_HEX(key: ArrayBuffer, data: string) {
	return createHMAC("SHA-256", key).update(data).digest("hex")
}

async function HASH_SHA256_HEX(data: string | ArrayBuffer) {
	return createHash("SHA-256").update(data).digest("hex")
}
