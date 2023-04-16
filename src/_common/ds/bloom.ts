import { fromStr } from "../uint8array.js"

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
	const PRIME32_1 = 0x9e3779b1
	const PRIME32_2 = 0x85ebca77
	const PRIME32_3 = 0xc2b2ae3d
	const PRIME32_4 = 0x27d4eb2f
	const PRIME32_5 = 0x165667b1

	const bLen = b.length
	let acc = seed + PRIME32_5
	let offset = 0
	if (bLen >= 16) {
		const accN = [
			seed + PRIME32_1 + PRIME32_2,
			seed + PRIME32_2,
			seed,
			seed - PRIME32_1,
		] as [number, number, number, number]

		const limit = bLen - 16
		let lane = 0
		while ((offset & 0xfffffff0) <= limit) {
			const i = offset
			const w =
				b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)
			const laneN = Math.imul(w, PRIME32_2)
			let accL = accN[lane]! + laneN
			accL = (accL << 13) | (accL >>> 19)
			accN[lane] = Math.imul(accL, PRIME32_1)
			lane = (lane + 1) & 0x3
			offset += 4
		}

		acc =
			((accN[0] << 1) | (accN[0] >>> 31)) +
			((accN[1] << 7) | (accN[1] >>> 25)) +
			((accN[2] << 12) | (accN[2] >>> 20)) +
			((accN[3] << 18) | (accN[3] >>> 14))
	}

	acc += bLen

	const limit = bLen - 4
	while (offset <= limit) {
		const i = offset
		const w =
			b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)
		acc += Math.imul(w, PRIME32_3)
		acc = (acc << 17) | (acc >>> 15)
		acc = Math.imul(acc, PRIME32_4)
		offset += 4
	}

	while (offset < bLen) {
		acc += Math.imul(b[offset]!, PRIME32_5)
		acc = (acc << 11) | (acc >>> 21)
		acc = Math.imul(acc, PRIME32_1)
		offset++
	}

	acc ^= acc >>> 15
	acc = Math.imul(acc, PRIME32_2)
	acc ^= acc >>> 13
	acc = Math.imul(acc, PRIME32_3)
	acc ^= acc >>> 16

	return acc >>> 0
}

// https://github.com/cockroachdb/pebble
// BSD-3-Clause
const pad = (n: number): number => (n > 127 ? n | 0xffffff00 : n)
export function murmur(b: Uint8Array, seed = 0xbc9f1d34): number {
	const m = 0xc6a4a793
	const bLen = b.length
	let h = seed ^ (bLen * m)

	let i = 0
	const limit = bLen - 4
	while (i <= limit) {
		const w =
			b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)
		h += w
		h = Math.imul(h, m)
		h ^= h >>> 16
		i += 4
	}

	/* eslint-disable no-fallthrough */
	switch (bLen - i) {
		// @ts-expect-error
		case 3: {
			h += pad(b[i + 2]!) << 16
			// fallthrough
		}
		// @ts-expect-error
		case 2: {
			h += pad(b[i + 1]!) << 8
			// fallthrough
		}
		case 1: {
			h += pad(b[i]!)
			h = Math.imul(h, m)
			h ^= h >>> 24
		}
	}
	/* eslint-enable no-fallthrough */

	return h >>> 0
}
