import * as uint8 from './uint8_array'
import * as buffer from './array_buffer'

export class Hash {
    private data: Uint8Array[]
    private algorithm: string
    constructor(algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512') {
        this.data = []
        this.algorithm = algorithm
    }

    update(data: Uint8Array | ArrayBuffer): void
    update(data: string, encoding?: 'utf8'): void
    update(data: string | Uint8Array | ArrayBuffer, _encoding?: 'utf8'): void {
        if (typeof data === 'string') {
            this.data.push(uint8.fromStr(data))
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
        const sig = await crypto.subtle.digest(this.algorithm, data)
        switch (encoding) {
            case 'hex':
                return buffer.toHex(sig)
            case 'utf8':
                return buffer.toStr(sig)
            default:
                return sig
        }
    }
}

export const createHash = (
    algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512',
) => new Hash(algorithm)
