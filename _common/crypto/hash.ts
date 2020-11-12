import * as uint8 from './uint8_array'
import * as buffer from './array_buffer'

export class Hash {
    private data: Uint8Array[]
    private algorithm: string
    constructor(
        algorithm: 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512',
    ) {
        this.data = []
        this.algorithm = algorithm
    }

    update(data: string | Uint8Array | ArrayBuffer): Hash {
        if (typeof data === 'string') {
            this.data.push(uint8.fromStr(data))
        } else if (data instanceof ArrayBuffer) {
            this.data.push(uint8.fromBuf(data))
        } else {
            this.data.push(data)
        }
        return this
    }

    async digest(): Promise<ArrayBuffer>
    async digest(encoding: 'hex' | 'utf8'): Promise<string>
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

type params = ConstructorParameters<typeof Hash>
export const createHash = (algorithm: params[0]) => new Hash(algorithm)
