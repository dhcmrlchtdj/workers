// https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/btoa

export const decode = (base64: string): string => {
    const decoded = atob(base64)
    const u8 = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
        u8[i] = decoded.charCodeAt(i)
    }
    const u16 = new Uint16Array(u8.buffer)
    const original = String.fromCharCode(...u16)
    return original
}

export const encode = (str: string): string => {
    const u16 = new Uint16Array(str.length)
    for (let i = 0; i < str.length; i++) {
        u16[i] = str.charCodeAt(i)
    }
    const u8 = new Uint8Array(u16.buffer)
    const converted = String.fromCharCode(...u8)
    const encoded = btoa(converted)
    return encoded
}
