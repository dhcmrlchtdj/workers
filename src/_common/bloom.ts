// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface Filter {
	add(key: string): void
	test(key: string): boolean
	reset(): void
}

function assert(c: boolean) {
	if (!c) throw new Error("assert")
}

export class DoubleHashBloomFilter implements Filter {
	private b: (boolean | undefined)[]
	private k: number
	private h1: (key: string) => number
	private h2: (key: string) => number
	constructor(
		size: number,
		falsePositiveRate: number,
		h1: (key: string) => number = FNV1a,
		h2: (key: string) => number = FNV1,
	) {
		assert(size > 0)
		assert(falsePositiveRate > 0 && falsePositiveRate < 1)

		this.k = -Math.log(falsePositiveRate) * Math.LOG2E
		const bits = size * this.k * Math.LOG2E
		this.b = new Array<boolean>(Math.ceil(bits))
		this.h1 = h1
		this.h2 = h2
	}
	private g(a: number, b: number, i: number): number {
		return (a + b * i) % this.b.length
	}
	add(key: string): void {
		const a = this.h1(key)
		const b = this.h2(key)
		for (let i = 0; i < this.k; i++) {
			const idx = this.g(a, b, i)
			this.b[idx] = true
		}
	}
	test(key: string): boolean {
		const a = this.h1(key)
		const b = this.h2(key)
		for (let i = 0; i < this.k; i++) {
			const idx = this.g(a, b, i)
			if (this.b[idx] !== true) {
				return false
			}
		}
		return true
	}
	reset(): void {
		this.b.fill(false)
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
