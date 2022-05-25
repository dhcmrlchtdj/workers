import { toHex } from "./uint8array.js"

export const UUIDv4 = (): string => {
    const id = new Uint8Array(16)
    crypto.getRandomValues(id)
    id[6] = (id[6]! & 0x0f) | 0x40 // version 4
    id[8] = (id[8]! & 0x3f) | 0x80 // IETF variant
    return toHex(id)
}
