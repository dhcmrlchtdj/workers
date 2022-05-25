import * as buffer from "../array_buffer.js"
import * as uint8 from "../uint8array.js"

export class HMAC {
    private key: PromiseLike<CryptoKey>
    private data: Uint8Array[]
    constructor(
        algorithm: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512",
        key: string | Uint8Array | ArrayBuffer,
    ) {
        this.data = []
        this.key = crypto.subtle.importKey(
            "raw",
            typeof key === "string" ? uint8.fromStr(key) : key,
            { name: "HMAC", hash: algorithm },
            false,
            ["sign"],
        )
    }

    update(data: string | Uint8Array | ArrayBuffer): this {
        if (typeof data === "string") {
            this.data.push(uint8.fromStr(data))
        } else if (data instanceof ArrayBuffer) {
            this.data.push(uint8.fromBuf(data))
        } else {
            this.data.push(data)
        }
        return this
    }

    async digest(): Promise<ArrayBuffer>
    async digest(encoding: "hex" | "utf8"): Promise<string>
    async digest(encoding?: "hex" | "utf8"): Promise<ArrayBuffer | string> {
        const data = uint8.concat(this.data)
        const key = await this.key
        const sig = await crypto.subtle.sign("HMAC", key, data)
        switch (encoding) {
            case "hex":
                return buffer.toHex(sig)
            case "utf8":
                return buffer.toStr(sig)
            default:
                return sig
        }
    }
}

type params = ConstructorParameters<typeof HMAC>
export const createHMAC = (algorithm: params[0], key: params[1]) =>
    new HMAC(algorithm, key)
