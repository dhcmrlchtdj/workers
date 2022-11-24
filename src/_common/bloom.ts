// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface Filter {
	add(key: string): void
	test(key: string): boolean
	reset(): void
}

export class BitMap {
	private bits: Uint8Array
	constructor(size: number) {
		this.bits = new Uint8Array(Math.ceil(size / 8))
	}
	set(pos: number) {
		this.bits[pos >>> 3] |= 1 << (pos & 7)
	}
	clear(pos: number) {
		this.bits[pos >>> 3] &= ~(1 << (pos & 7))
	}
	test(pos: number): boolean {
		return (this.bits[pos >>> 3]! & (1 << (pos & 7))) !== 0
	}
	clearAll() {
		this.bits.fill(0)
	}
}

// n: the number of elements
// m: the number of bits
// k: the number of hashing functions
// p: false positive rate
export class BloomFilter implements Filter {
	private b: BitMap
	private m: number
	private k: number
	private h1: (key: string) => number
	private h2: (key: string) => number
	constructor(m: number, k: number, h1 = FNV1a, h2 = FNV1) {
		this.b = new BitMap(m)
		this.m = m
		this.k = k
		this.h1 = h1
		this.h2 = h2
	}
	static withEstimate(n: number, p: number) {
		const { m, k } = this.estimate(n, p)
		return new this(m, k)
	}
	static estimate(n: number, p: number): { m: number; k: number } {
		// https://en.wikipedia.org/wiki/Bloom_filter#Optimal_number_of_hash_functions
		const ln2 = Math.log(2)
		const _m = Math.ceil((-1 * n * Math.log(p)) / ln2 ** 2)
		const m = Math.ceil(_m / 8) * 8
		const k = Math.ceil((m / n) * ln2)
		return { m, k }
	}

	private g(a: number, b: number, i: number): number {
		return (a + b * i) % this.m
	}
	add(key: string): void {
		const a = this.h1(key)
		const b = this.h2(key)
		for (let i = 0; i < this.k; i++) {
			this.b.set(this.g(a, b, i))
		}
	}
	test(key: string): boolean {
		const a = this.h1(key)
		const b = this.h2(key)
		for (let i = 0; i < this.k; i++) {
			if (!this.b.test(this.g(a, b, i))) {
				return false
			}
		}
		return true
	}
	reset(): void {
		this.b.clearAll()
	}
}

// there is a faster FNV implementation at https://github.com/tjwebb/fnv-plus/tree/master/benchmark
function FNV1a(str: string): number {
	let hash = 0x811c9dc5
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i)
		hash +=
			(hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
	}
	return hash >>> 0
}
function FNV1(str: string): number {
	let hash = 0x811c9dc5
	for (let i = 0; i < str.length; i++) {
		hash +=
			(hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
		hash ^= str.charCodeAt(i)
	}
	return hash >>> 0
}
