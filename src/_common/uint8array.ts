export const fromBuf = (buf: ArrayBufferLike): Uint8Array => new Uint8Array(buf)

export const toBuf = (u: Uint8Array): ArrayBufferLike => u.buffer

export const fromStr = (s: string): Uint8Array => new TextEncoder().encode(s)

export const toStr = (u: Uint8Array): string => new TextDecoder().decode(u)

export const fromHex = (hex: string): Uint8Array => {
	const buf = new Uint8Array(hex.length >>> 1)
	for (let i = 0, len = hex.length; i < len; i += 2) {
		const parsed = parseInt(hex.slice(i, i + 2), 16)
		buf[i] = parsed
		i += 2
	}
	return buf
}

const u8ToHex = (() => {
	const alphabet = "0123456789abcdef"
	const table = new Array<string>(256)
	for (let i = 0; i < 16; i++) {
		const i16 = i * 16
		for (let j = 0; j < 16; j++) {
			table[i16 + j] = alphabet[i]! + alphabet[j]!
		}
	}
	return table
})()
export const toHex = (u: Uint8Array): string => {
	let out = ""
	for (let i = 0, len = u.length; i < len; i++) {
		out += u8ToHex[u[i]!]
	}
	return out
}

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
