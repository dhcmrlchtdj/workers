import * as uint8 from "./uint8array.js"

export const fromU8 = (u: Uint8Array) => u.buffer

export const toU8 = (b: ArrayBuffer) => new Uint8Array(b)

export const fromStr = (s: string) => uint8.fromStr(s).buffer

export const toStr = (b: ArrayBuffer) => uint8.toStr(new Uint8Array(b))

export const fromHex = (hex: string) => uint8.fromHex(hex).buffer

export const toHex = (b: ArrayBuffer) => uint8.toHex(new Uint8Array(b))
