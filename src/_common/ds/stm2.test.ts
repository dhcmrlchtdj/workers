import { describe, expect, test } from "@jest/globals"
import { atomically, Var } from "./stm2"

describe("STM2", () => {
	test("sum", async () => {
		const sum = new Var<number>(0)

		const tasks = []
		for (let i = 0; i < 1000; i++) {
			tasks.push(
				atomically((txn) => {
					const v = txn.load(sum)
					txn.store(sum, v + 1)
					txn.commit()
				}),
			)
		}
		await Promise.all(tasks)

		const total = await atomically((txn) => txn.load(sum))
		expect(total).toBe(1000)
	})
})
