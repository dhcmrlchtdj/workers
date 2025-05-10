import { describe, expect, test } from "@jest/globals"
import { ARC } from "./lru.ts"

describe("ARC", () => {
	// https://github.com/hashicorp/golang-lru/blob/v2.0.1/arc_test.go
	// MPL-2.0 license
	test("adaptive", () => {
		const arc = new ARC<number, number>(4)

		arc.set(0, 0)
		arc.set(1, 1)
		arc.set(2, 2)
		arc.set(3, 3)
		// @ts-expect-error
		expect(arc.recent.size()).toBe(4)

		arc.get(0)
		arc.get(1)
		// @ts-expect-error
		expect(arc.frequent.size()).toBe(2)

		arc.set(4, 4)
		// @ts-expect-error
		expect(arc.recentEvicted.size()).toBe(1)

		arc.set(2, 2)
		// @ts-expect-error
		expect(arc.recentEvicted.size()).toBe(1)
		// @ts-expect-error
		expect(arc.p).toBe(1)
		// @ts-expect-error
		expect(arc.frequent.size()).toBe(3)

		arc.set(4, 4)
		// @ts-expect-error
		expect(arc.recent.size()).toBe(0)
		// @ts-expect-error
		expect(arc.frequent.size()).toBe(4)

		arc.set(5, 5)
		// @ts-expect-error
		expect(arc.recent.size()).toBe(1)
		// @ts-expect-error
		expect(arc.frequent.size()).toBe(3)
		// @ts-expect-error
		expect(arc.frequentEvicted.size()).toBe(1)

		arc.set(0, 0)
		// @ts-expect-error
		expect(arc.recent.size()).toBe(0)
		// @ts-expect-error
		expect(arc.frequent.size()).toBe(4)
		// @ts-expect-error
		expect(arc.recentEvicted.size()).toBe(2)
		// @ts-expect-error
		expect(arc.frequentEvicted.size()).toBe(0)
		// @ts-expect-error
		expect(arc.p).toBe(0)
	})
})
