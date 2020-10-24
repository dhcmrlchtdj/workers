import * as uint8 from './uint8_array'

export const fromU8 = (u: Uint8Array) => u.buffer

export const toU8 = (b: ArrayBuffer) => new Uint8Array(b)

export const fromUtf8 = (s: string) => uint8.fromUtf8(s).buffer

export const toUtf8 = (b: ArrayBuffer) => uint8.toUtf8(new Uint8Array(b))

export const fromHex = (hex: string) => uint8.fromHex(hex).buffer

export const toHex = (b: ArrayBuffer) => uint8.toHex(new Uint8Array(b))
