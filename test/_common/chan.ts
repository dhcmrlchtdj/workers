import { Channel, Select } from "../../src/_common/chan.js"

const noop = () => true

describe("Channel", () => {
    test("non-block", () => {
        const ch = new Channel<number>()

        const r1 = ch.trySend(10)
        expect(r1).toBe(false)

        const r2 = ch.tryReceive()
        expect(r2.isNone).toBe(true)
    })

    test("block", async () => {
        const ch = new Channel<number>()

        await Promise.all([
            (async () => {
                const r = await ch.send(10)
                expect(r).toBe(true)
            })(),
            (async () => {
                const r = await ch.receive()
                expect(r.unwrap()).toBe(10)
            })(),
        ])
    })
})

describe("Select", () => {
    test("duplicated channel", () => {
        const select = new Select()
        const ch = new Channel<number>()

        select.send(ch, 1, noop)
        expect(() => select.send(ch, 2, noop)).toThrow()
    })

    test("select running", () => {
        const select = new Select()
        const ch = new Channel<number>()

        select.receive(ch, noop)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        select.select()
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        expect(select.select()).rejects.toThrow()
    })

    test("select empty", async () => {
        const select = new Select()

        const r1 = select.trySelect()
        expect(r1).toBe(null)

        const r2 = await select.select()
        expect(r2).toBe(null)
    })

    test("select timeout", async () => {
        const ch1 = new Channel<number>()
        const select = new Select()
        select.send(ch1, 1, noop)

        const r = select.trySelect()
        expect(r).toBe(null)

        const r1 = await select.select({ signal: AbortSignal.timeout(1) })
        expect(r1).toBe(null)
    })

    test("select channel 1", async () => {
        const ch1 = new Channel<number>()
        const ch2 = new Channel<string>()

        const background = (async () => {
            const r = await ch1.receive()
            expect(r.unwrap()).toBe(1)
        })()

        const select = new Select()

        const id = select.send(ch1, 1, noop)
        select.send(ch2, "", noop)
        const r = await select.select()
        expect(r).toBe(id)

        await background
    })

    test("select channel 2", async () => {
        const ch1 = new Channel<number>()

        const background = (async () => {
            const r = await ch1.send(10)
            expect(r).toBe(true)
        })()

        const select = new Select()

        const id = select.receive(ch1, (data, i) => {
            expect(data.unwrap()).toBe(10)
            expect(i).toBe(id)
        })

        const r = await select.select()
        expect(r).toBe(id)

        await background
    })
})
