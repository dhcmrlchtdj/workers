import { Deferred } from "../../src/_common/deferred.js"
import {
	Channel,
	fromAbortSignal,
	fromPromise,
	select,
} from "../../src/_common/event.js"

describe("Op", () => {
	test("fromPromise", async () => {
		const d = new Deferred<number>()
		const op = fromPromise(d.promise)

		expect(op.poll().isNone()).toBe(true)

		d.resolve(10)

		const r = await op.sync()
		expect(r).toBe(10)

		expect(op.poll().isSome()).toBe(true)
		await expect(op.poll().unwrap()).resolves.toBe(10)
	})

	test("fromAbortSignal", async () => {
		const op = fromAbortSignal(AbortSignal.timeout(1))
		expect(op.poll().isNone()).toBe(true)

		const r = await op.sync()
		expect(r).toBeInstanceOf(DOMException)
	})
})

describe("Channel", () => {
	test("simple", async () => {
		const ch = new Channel<number>()
		await Promise.all([
			(async () => {
				const r = await ch.send(10).sync()
				expect(r).toBe(true)
			})(),
			(async () => {
				const r = await ch.receive().sync()
				expect(r.unwrap()).toBe(10)
			})(),
		])
	})
	test("close", async () => {
		const ch = new Channel<number>()
		const op = ch.receive().wrap((v) => {
			expect(v.isNone()).toBe(true)
		})
		expect(op.poll().isNone()).toBe(true)

		const r = op.sync()

		expect(ch.isClosed()).toBe(false)
		ch.close()
		expect(ch.isClosed()).toBe(true)

		await r
	})
})

describe("Select", () => {
	test("select channel 1", async () => {
		const ch1 = new Channel<number>()
		const ch2 = new Channel<string>()

		const background = (async () => {
			const r = await ch1.receive().sync()
			expect(r.unwrap()).toBe(1)
		})()

		const r = await select<number>(
			ch1.send(1).wrap(() => 1),
			ch2.send("").wrap(() => 2),
		)
		expect(r).toBe(1)

		await background
	})

	test("select channel 2", async () => {
		const ch1 = new Channel<number>()

		const background = (async () => {
			const r = await ch1.send(10).sync()
			expect(r).toBe(true)
		})()

		const r = await select(
			ch1.receive().wrap((n) => {
				expect(n.unwrap()).toBe(10)
				return n
			}),
		)
		expect(r.unwrap()).toBe(10)

		await background
	})

	test("select channel 3", async () => {
		const ch1 = new Channel<number>()

		const background = (async () => {
			const r1 = await ch1.send(10).sync()
			expect(r1).toBe(true)

			const r2 = await ch1.send(20).sync()
			expect(r2).toBe(true)
		})()

		await select(
			ch1.receive().wrap((data) => {
				expect(data.unwrap()).toBe(10)
			}),
		)

		await select(
			ch1.receive().wrap((data) => {
				expect(data.unwrap()).toBe(20)
			}),
		)

		await background
	})
})
