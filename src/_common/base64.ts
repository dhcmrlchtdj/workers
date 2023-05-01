// https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/btoa

export const fromBase64 = (base64: string): string => {
	return decodeURIComponent(escape(atob(base64)))
}

export const toBase64 = (str: string): string => {
	return btoa(unescape(encodeURIComponent(str)))
}
