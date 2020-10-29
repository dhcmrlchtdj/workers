// https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/btoa

export const decode = (base64: string): string => {
    return decodeURIComponent(escape(atob(base64)))
}

export const encode = (str: string): string => {
    return btoa(unescape(encodeURIComponent(str)))
}
