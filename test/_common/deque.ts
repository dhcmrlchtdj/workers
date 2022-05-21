import { Deque } from "../../src/_common/deque"

describe("Deque", () => {
    test("grow case 1", () => {
        const deque = Deque.fromArray([1, 2, 3, 4, 5, 6, 7])
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()

        deque.pushBack(8)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()
    })

    test("grow case 2", () => {
        const deque = new Deque()

        deque.pushBack(6)
        deque.pushBack(7)
        deque.pushFrontArray([5, 4, 3, 2, 1])
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()

        deque.pushBack(8)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()
    })

    test("grow case 3", () => {
        const deque = new Deque()

        deque.pushBackArray([3, 4, 5, 6, 7])
        deque.pushFront(2)
        deque.pushFront(1)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()

        deque.pushBack(8)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()
    })

    test("pushBackArray 0", () => {
        const deque = new Deque()

        deque.pushBack(1)
        deque.pushBack(2)
        deque.pushBack(3)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()

        deque.pushBack(4)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()
    })

    test("pushBackArray 1", () => {
        const deque = new Deque()

        deque.pushBackArray([1, 2, 3])
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()

        deque.pushBack(4)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()
    })

    test("pushBackArray 2", () => {
        const deque = new Deque()

        deque.pushBackArray([1, 2, 3, 4])
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()
    })

    test("pushFrontArray 0", () => {
        const deque = new Deque()

        deque.pushFront(1)
        deque.pushFront(2)
        deque.pushFront(3)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()

        deque.pushFront(4)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()
    })

    test("pushFrontArray 1", () => {
        const deque = new Deque()

        deque.pushFrontArray([1, 2, 3])
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()

        deque.pushFront(4)
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()
    })

    test("pushFrontArray 2", () => {
        const deque = new Deque()

        deque.pushFrontArray([1, 2, 3, 4])
        // @ts-expect-error
        expect(deque.buf).toMatchSnapshot()
        expect(deque.toArray()).toMatchSnapshot()
    })
})
