import { Channel, sync } from "../../src/_common/event.js"

describe("Channel", () => {
	test("block", async () => {
		const ch = new Channel<number>()
		await Promise.all([
			(async () => {
				const r = await sync(ch.send(10))
				expect(r).toBe(true)
			})(),
			(async () => {
				const r = await sync(ch.receive())
				expect(r).toBe(10)
			})(),
		])
	})
})
