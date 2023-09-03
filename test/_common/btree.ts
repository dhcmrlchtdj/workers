import { describe, expect, test } from "@jest/globals"
import { BTree } from "../../src/_common/ds/btree.ts"

describe("BTree", () => {
	test("degree 2", () => {
		let b = new BTree<number, number>(2)
		expect(b.toString()).toMatchSnapshot()
		b = b.set(10, 10)
		expect(b.toString()).toMatchSnapshot()
		b = b.set(20, 20)
		expect(b.toString()).toMatchSnapshot()
		b = b.set(30, 30)
		expect(b.toString()).toMatchSnapshot()
		b = b.set(40, 40)
		expect(b.toString()).toMatchSnapshot()
		b = b.set(8, 8).set(15, 15)
		expect(b.toString()).toMatchSnapshot()
		b = b.set(21, 21)
		expect(b.toString()).toMatchSnapshot()
		b = b.set(33, 33)
		expect(b.toString()).toMatchSnapshot()
		b = b.set(5, 5)
		expect(b.toString()).toMatchSnapshot()

		expect([...b.keys()]).toMatchSnapshot()
		expect([...b.values()]).toMatchSnapshot()
		expect([...b.entries()]).toMatchSnapshot()

		expect(b.has(8)).toBe(true)
		b = b.delete(8)
		expect(b.has(8)).toBe(false)
		expect(b.toString()).toMatchSnapshot()

		b = b.delete(20)
		expect(b.toString()).toMatchSnapshot()
		b = b.delete(33).delete(30)
		expect(b.toString()).toMatchSnapshot()
		b = b.delete(40)
		expect(b.toString()).toMatchSnapshot()

		expect([...b.entries()]).toMatchSnapshot()
	})

	test("cow", () => {
		const b = new BTree<number, number>(2).set(1, 1).set(2, 2).set(3, 3)

		const b1 = b.set(1, 1)
		expect(b1.toString()).toMatchSnapshot()
		expect(b1 === b).toBe(true)

		const b2 = b.set(1, 20)
		expect(b2.toString()).toMatchSnapshot()
		expect(b2 === b).toBe(false)

		const b3 = b.set(4, 4)
		expect(b3.toString()).toMatchSnapshot()
		expect(b3 === b).toBe(false)

		const b4 = b.delete(1)
		expect(b4.toString()).toMatchSnapshot()
		expect(b4 === b).toBe(false)

		const b5 = b.delete(4)
		expect(b5.toString()).toMatchSnapshot()
		expect(b5 === b).toBe(true)
	})
})
