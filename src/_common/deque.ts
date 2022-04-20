import { Option, Some, None } from "./option"

// credit
// https://doc.rust-lang.org/std/collections/struct.VecDeque.html
// https://github.com/petkaantonov/deque
export class Deque<T> {
    // front | ...[head]...[tail]... | back
    private head: number // current head index
    private tail: number // next tail index
    private buf: Array<T>
    private cap: number // cap must to be power of two
    private mask: number
    constructor() {
        this.head = 0
        this.tail = 0
        this.cap = 4
        this.mask = this.cap - 1
        this.buf = new Array(this.cap)
    }
    get length(): number {
        return (this.tail - this.head + this.cap) & this.mask
    }
    isEmpty(): boolean {
        return this.head === this.tail
    }
    private full(): boolean {
        return this.cap - this.length === 1
    }
    private grow() {
        const oldCap = this.cap
        this.cap <<= 1
        this.mask = this.cap - 1
        this.buf.length = this.cap

        if (this.head <= this.tail) {
            //  H             T
            // [o o o o o o o . ]
            //  H             T
            // [o o o o o o o . . . . . . . . . ]
        } else if (this.tail < oldCap - this.head) {
            //      T H
            // [o o . o o o o o ]
            //        H             T
            // [. . . o o o o o o o . . . . . . ]
            const size = this.tail
            move(this.buf, size, 0, oldCap)
            this.tail = oldCap + size
        } else {
            //            T H
            // [o o o o o . o o ]
            //            T                 H
            // [o o o o o . . . . . . . . . o o ]
            const size = oldCap - this.head
            const newHead = this.cap - size
            move(this.buf, size, this.head, newHead)
            this.head = newHead
        }
    }
    pushBack(value: T) {
        if (this.full()) {
            this.grow()
        }
        const idx = this.tail
        this.tail = (this.tail + 1) & this.mask
        this.buf[idx] = value
    }
    popBack(): Option<T> {
        if (this.isEmpty()) {
            return None
        } else {
            const idx = (this.tail - 1 + this.cap) & this.mask
            const item = this.buf[idx]!
            this.buf[idx] = undefined!
            this.tail = idx
            return Some(item)
        }
    }
    pushFront(value: T) {
        if (this.full()) {
            this.grow()
        }
        const idx = (this.head - 1 + this.cap) & this.mask
        this.head = idx
        this.buf[idx] = value
    }
    popFront(): Option<T> {
        if (this.isEmpty()) {
            return None
        } else {
            const idx = this.head
            const item = this.buf[idx]!
            this.buf[idx] = undefined!
            this.head = (this.head + 1) & this.mask
            return Some(item)
        }
    }
    get(index: number): Option<T> {
        if (index >= 0 && index < this.length) {
            const idx = (this.head + index) & this.mask
            return Some(this.buf[idx]!)
        } else {
            return None
        }
    }
    map<R>(fn: (item: T, index?: number) => R): R[] {
        const ret = new Array<R>(this.length)
        for (let i = 0; i < this.length; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            ret[i] = fn(item, i)
        }
        return ret
    }
    forEach(fn: (item: T, index?: number) => unknown) {
        for (let i = 0; i < this.length; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            fn(item, i)
        }
    }
}

function move(
    target: Array<unknown>,
    size: number,
    fromPos: number,
    toPos: number,
) {
    for (let i = 0; i <= size; i++) {
        target[toPos + i] = target[fromPos + i]
        target[fromPos + i] = undefined
    }
}
