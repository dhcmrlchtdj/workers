import * as uint8 from './uint8_array'
import * as buffer from './array_buffer'

export class Hmac {
    key: PromiseLike<CryptoKey>
    data: Uint8Array[]
    constructor(
        algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512',
        key: string | Uint8Array | ArrayBuffer,
    ) {
        this.data = []
        this.key = crypto.subtle.importKey(
            'raw',
            typeof key === 'string' ? uint8.fromUtf8(key) : key,
            {
                name: 'HMAC',
                hash: algorithm,
            },
            false,
            ['sign'],
        )
    }

    update(data: Uint8Array | ArrayBuffer): void
    update(data: string, encoding?: 'utf8'): void
    update(data: string | Uint8Array | ArrayBuffer, _encoding?: 'utf8'): void {
        if (typeof data === 'string') {
            this.data.push(uint8.fromUtf8(data))
        } else if (data instanceof ArrayBuffer) {
            this.data.push(uint8.fromBuf(data))
        } else {
            this.data.push(data)
        }
    }

    async digest(): Promise<ArrayBuffer>
    async digest(encoding: 'hex'): Promise<string>
    async digest(encoding: 'utf8'): Promise<string>
    async digest(encoding?: 'hex' | 'utf8'): Promise<ArrayBuffer | string> {
        const data = uint8.concat(this.data)
        const key = await this.key
        const sig = await crypto.subtle.sign('HMAC', key, data)
        switch (encoding) {
            case 'hex':
                return buffer.toHex(sig)
            case 'utf8':
                return buffer.toUtf8(sig)
            default:
                return sig
        }
    }
}

export const createHmac = (
    algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512',
    key: string | Uint8Array | ArrayBuffer,
) => new Hmac(algorithm, key)
