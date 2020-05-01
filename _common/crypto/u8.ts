const enc = new TextEncoder()
const dec = new TextDecoder()
const reHEX = /[0-9a-zA-Z]{2}/g

export const fromBuf = (buf: ArrayBuffer) => new Uint8Array(buf)

export const toBuf = (u: Uint8Array) => u.buffer

export const fromUtf8 = (s: string) => enc.encode(s)

export const toUtf8 = (u: Uint8Array) => dec.decode(u)

export const fromHex = (hex: string) =>
    new Uint8Array(hex.match(reHEX)!.map((x) => parseInt(x, 16)))

export const toHex = (u: Uint8Array) =>
    Array.from(u)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

export const concat = (bufs: Uint8Array[]): Uint8Array => {
    const len = bufs.reduce((acc, b) => acc + b.length, 0)
    const r = new Uint8Array(len)
    let offset = 0
    bufs.forEach((b) => {
        r.set(b, offset)
        offset += b.length
    })
    return r
}
