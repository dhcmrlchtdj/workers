import { fromStr } from "../../src/_common/uint8array.js"
import { xxh32 } from "../../src/_common/bloom.js"

describe("BloomFilter", () => {
	test("xxh32", () => {
		// https://github.com/Jason3S/xxhash/blob/main/src/xxHash32.test.ts
		const cases = [
			["a", 0x550d7456],
			["ab", 0x4999fc53],
			["abc", 0x32d153ff],
			["abcd", 0xa3643705],
			["abcde", 0x9738f19b],
			["ab".repeat(10), 0x244fbf7c],
			["abc".repeat(100), 0x55cad6be],
			["My text to hash 😊", 0xaf7fd356],
		] as [string, number][]
		cases.forEach(([i, o]) => {
			expect(xxh32(fromStr(i))).toBe(o)
		})
	})
})
