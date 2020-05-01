import * as u8 from './u8'

export const fromU8 = (u: Uint8Array) => u.buffer

export const toU8 = (b: ArrayBuffer) => new Uint8Array(b)

export const fromUtf8 = (s: string) => u8.fromUtf8(s).buffer

export const toUtf8 = (b: ArrayBuffer) => u8.toUtf8(new Uint8Array(b))

export const fromHex = (hex: string) => u8.fromHex(hex).buffer

export const toHex = (b: ArrayBuffer) => u8.toHex(new Uint8Array(b))
