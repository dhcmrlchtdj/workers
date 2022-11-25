import { fromStr } from "./uint8array.js"

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

// https://en.wikipedia.org/wiki/Double_hashing
// https://en.wikipedia.org/wiki/Bloom_filter#Optimal_number_of_hash_functions
// n: the number of elements
// m: the number of bits
// k: the number of hashing functions
// p: false positive rate
export class BloomFilter implements Filter {
	private b: BitMap
	private m: number
	private k: number
	private h: (key: string) => { h1: number; h2: number }
	constructor(
		m: number,
		k: number,
		h: (key: string) => { h1: number; h2: number },
	) {
		this.b = new BitMap(m)
		this.m = m
		this.k = k
		this.h = h
	}
	static withEstimate(
		n: number,
		p: number,
		h: (key: string) => { h1: number; h2: number },
	) {
		const { m, k } = this.estimate(n, p)
		return new this(m, k, h)
	}
	static estimate(n: number, p: number): { m: number; k: number } {
		const _m = Math.ceil(-1 * n * Math.log(p) * Math.LOG2E ** 2)
		const m = Math.ceil(_m / 8) * 8
		const k = Math.ceil(m / n / Math.LOG2E)
		return { m, k }
	}

	add(key: string): void {
		const { h1, h2 } = this.h(key)
		for (let i = 0; i < this.k; i++) {
			const pos = (h1 + i * h2 + i ** 2) % this.m
			this.b.set(pos)
		}
	}
	test(key: string): boolean {
		const { h1, h2 } = this.h(key)
		for (let i = 0; i < this.k; i++) {
			const pos = (h1 + i * h2 + i ** 2) % this.m
			if (!this.b.test(pos)) {
				return false
			}
		}
		return true
	}
	reset(): void {
		this.b.clearAll()
	}
}

export function bloomHash(key: string): { h1: number; h2: number } {
	const h1 = xxh32(fromStr(key))
	const h2 = (h1 >> 17) | (h1 << 15)
	// const h3 = xxh32(key, seedX);
	// const h4 = xxh32(key, seedY);
	return { h1, h2 }
}

// https://github.com/Jason3S/xxhash
// MIT
export function xxh32(b: Uint8Array, seed = 0): number {
	const PRIME32_1 = 2654435761
	const PRIME32_2 = 2246822519
	const PRIME32_3 = 3266489917
	const PRIME32_4 = 668265263
	const PRIME32_5 = 374761393

	let acc = (seed + PRIME32_5) & 0xffffffff
	let offset = 0
	if (b.length >= 16) {
		const accN = [
			(seed + PRIME32_1 + PRIME32_2) & 0xffffffff,
			(seed + PRIME32_2) & 0xffffffff,
			(seed + 0) & 0xffffffff,
			(seed - PRIME32_1) & 0xffffffff,
		] as [number, number, number, number]

		const limit = b.length - 16
		let lane = 0
		for (offset = 0; (offset & 0xfffffff0) <= limit; offset += 4) {
			const i = offset
			const laneN0 = b[i + 0]! + (b[i + 1]! << 8)
			const laneN1 = b[i + 2]! + (b[i + 3]! << 8)
			const laneNP = laneN0 * PRIME32_2 + ((laneN1 * PRIME32_2) << 16)
			let acc = (accN[lane]! + laneNP) & 0xffffffff
			acc = (acc << 13) | (acc >>> 19)
			const acc0 = acc & 0xffff
			const acc1 = acc >>> 16
			accN[lane] =
				(acc0 * PRIME32_1 + ((acc1 * PRIME32_1) << 16)) & 0xffffffff
			lane = (lane + 1) & 0x3
		}

		acc =
			(((accN[0] << 1) | (accN[0] >>> 31)) +
				((accN[1] << 7) | (accN[1] >>> 25)) +
				((accN[2] << 12) | (accN[2] >>> 20)) +
				((accN[3] << 18) | (accN[3] >>> 14))) &
			0xffffffff
	}

	acc = (acc + b.length) & 0xffffffff

	const limit = b.length - 4
	while (offset <= limit) {
		const i = offset
		const laneN0 = b[i + 0]! + (b[i + 1]! << 8)
		const laneN1 = b[i + 2]! + (b[i + 3]! << 8)
		const laneP = laneN0 * PRIME32_3 + ((laneN1 * PRIME32_3) << 16)
		acc = (acc + laneP) & 0xffffffff
		acc = (acc << 17) | (acc >>> 15)
		acc =
			((acc & 0xffff) * PRIME32_4 + (((acc >>> 16) * PRIME32_4) << 16)) &
			0xffffffff
		offset += 4
	}

	while (offset < b.length) {
		const lane = b[offset]!
		acc = acc + lane * PRIME32_5
		acc = (acc << 11) | (acc >>> 21)
		acc =
			((acc & 0xffff) * PRIME32_1 + (((acc >>> 16) * PRIME32_1) << 16)) &
			0xffffffff
		offset++
	}

	acc = acc ^ (acc >>> 15)
	acc =
		(((acc & 0xffff) * PRIME32_2) & 0xffffffff) +
		(((acc >>> 16) * PRIME32_2) << 16)
	acc = acc ^ (acc >>> 13)
	acc =
		(((acc & 0xffff) * PRIME32_3) & 0xffffffff) +
		(((acc >>> 16) * PRIME32_3) << 16)
	acc = acc ^ (acc >>> 16)

	return acc < 0 ? acc + 4294967296 : acc
}
