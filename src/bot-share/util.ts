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
