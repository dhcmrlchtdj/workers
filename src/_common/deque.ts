import { Option, Some, None } from "./option"

// credit
// https://doc.rust-lang.org/std/collections/struct.VecDeque.html
// https://github.com/petkaantonov/deque
export class Deque<T> {
    // front | ...[tail]...[head]... | back
    private head: number // next head index
    private tail: number // current tail index
    private buf: Array<T>
    private cap: number // cap must to be power of two
    private mask: number
    constructor(capacity?: number) {
        this.head = 0
        this.tail = 0
        this.cap = getCapacity(capacity)
        this.mask = this.cap - 1
        this.buf = []
        this.buf = new Array(this.cap)
    }
    get length(): number {
        return (this.head - this.tail + this.cap) & this.mask
    }
    isEmpty(): boolean {
        return this.head === this.tail
    }
    private full(): boolean {
        return this.cap - this.length === 1
    }
    private grow() {
        const oldCap = this.cap
        this.cap *= 2
        this.mask = this.cap - 1
        this.buf.length = this.cap

        if (this.tail <= this.head) {
            //  T             H
            // [o o o o o o o . ]
            //  T             H
            // [o o o o o o o . . . . . . . . . ]
        } else if (this.head < oldCap - this.tail) {
            //      H T
            // [o o . o o o o o ]
            //        T             H
            // [. . . o o o o o o o . . . . . . ]
            const size = this.head - 0
            move(this.buf, size, 0, oldCap)
            this.head = oldCap + size
        } else {
            //            H T
            // [o o o o o . o o ]
            //            H                 T
            // [o o o o o . . . . . . . . . o o ]
            const size = oldCap - this.tail
            const newTail = this.cap - size
            move(this.buf, size, this.tail, newTail)
            this.tail = newTail
        }
    }
    pushBack(value: T) {
        if (this.full()) {
            this.grow()
        }
        const idx = this.head
        this.head = (this.head + 1) & this.mask
        this.buf[idx] = value
    }
    popBack(): Option<T> {
        if (this.isEmpty()) {
            return None
        } else {
            const idx = (this.head - 1 + this.cap) & this.mask
            const item = this.buf[idx]!
            this.buf[idx] = undefined!
            this.head = idx
            return Some(item)
        }
    }
    pushFront(value: T) {
        if (this.full()) {
            this.grow()
        }
        const idx = (this.tail - 1 + this.cap) & this.mask
        this.tail = idx
        this.buf[idx] = value
    }
    popFront(): Option<T> {
        if (this.isEmpty()) {
            return None
        } else {
            const idx = this.tail
            const item = this.buf[idx]!
            this.buf[idx] = undefined!
            this.tail = (this.tail + 1) & this.mask
            return Some(item)
        }
    }
    get(index: number): Option<T> {
        if (index < this.length) {
            const idx = (this.tail + index) & this.mask
            return Some(this.buf[idx]!)
        } else {
            return None
        }
    }
    map<R>(fn: (item: T, index?: number) => R): R[] {
        const ret = new Array<R>(this.length)
        for (let i = 0; i < this.length; i++) {
            const item = this.buf[(this.tail + i) & this.mask]!
            ret[i] = fn(item, i)
        }
        return ret
    }
    forEach(fn: (item: T, index?: number) => unknown) {
        for (let i = 0; i < this.length; i++) {
            const item = this.buf[(this.tail + i) & this.mask]!
            fn(item, i)
        }
    }
}

function getCapacity(capacity: number | undefined): number {
    if (typeof capacity !== "number") return 8
    if (capacity! < 0) throw new Error("capacity must greater than 0")
    if (capacity! > 1073741824)
        throw new Error("capacity must lesser than 2**31")
    return pow2AtLeast(Math.max(8, capacity!))
}

function pow2AtLeast(n: number): number {
    n = n >>> 0
    n = n - 1
    n = n | (n >> 1)
    n = n | (n >> 2)
    n = n | (n >> 4)
    n = n | (n >> 8)
    n = n | (n >> 16)
    return n + 1
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
