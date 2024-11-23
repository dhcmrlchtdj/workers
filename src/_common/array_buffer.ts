import * as uint8 from "./uint8array.ts"

export const fromU8 = (u: Uint8Array): ArrayBufferLike => uint8.toBuf(u)

export const toU8 = (b: ArrayBufferLike): Uint8Array => new Uint8Array(b)

export const fromStr = (s: string): ArrayBufferLike =>
	uint8.toBuf(uint8.fromStr(s))

export const toStr = (b: ArrayBufferLike): string =>
	uint8.toStr(new Uint8Array(b))

export const fromHex = (hex: string): ArrayBufferLike =>
	uint8.toBuf(uint8.fromHex(hex))

export const toHex = (b: ArrayBufferLike): string =>
	uint8.toHex(new Uint8Array(b))
