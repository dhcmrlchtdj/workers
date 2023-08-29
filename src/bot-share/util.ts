import { detectContentType, mimeToExt } from "../_common/http/sniff.js"

type ENV = {
	BA: KVNamespace
	R2share: R2Bucket
	R2apac: R2Bucket
}

//

export function stringifyError(err: unknown, stringify: true): string
export function stringifyError(err: unknown, stringify: false): string[]
export function stringifyError(
	err: unknown,
	stringify: boolean,
): string | string[] {
	let arr: string[]
	if (err instanceof Error && err.stack) {
		arr = err.stack.split(/\n +/)
	} else {
		arr = [String(err)]
	}
	return stringify ? JSON.stringify(arr, null, 4) : arr
}

export function randomKey(): string {
	const ts = 10_000_000_000_000 - Date.now()
	const rand = String(Math.random()).slice(2)
	return ts + rand
}

///

export function keyToSharedUrl(key: string) {
	return "https://worker.h11.io/share/" + key
}

export function sharedUrlToKey(url: string) {
	const prefix = "https://worker.h11.io/share/"
	if (url.startsWith(prefix)) {
		return url.slice(prefix.length)
	} else {
		return ""
	}
}

//

export async function uploadByUrl(
	env: ENV,
	url: string,
	filename: string | undefined,
	contentType: string | undefined,
): Promise<string> {
	const resp = await fetch(url)
	if (!resp.ok) throw new Error(String(resp.status))
	const body = await resp.arrayBuffer()
	return uploadByBuffer(env, body, filename, contentType)
}

export async function uploadByBuffer(
	env: ENV,
	data: ArrayBuffer,
	filename: string | undefined,
	contentType: string | undefined,
): Promise<string> {
	const cType = contentType ?? detectContentType(data)

	let objectKey = randomKey()
	if (filename) objectKey += "." + filename
	const ext = mimeToExt[cType]
	if (ext && !(filename && filename.endsWith(ext))) {
		objectKey += "." + ext
	}

	const uploaded = await env.R2share.put(
		encodeURIComponent(objectKey),
		data,
		{
			httpMetadata: { contentType: cType },
			customMetadata: { via: "telegram-bot" },
		},
	)
	return keyToSharedUrl(uploaded.key)
}
