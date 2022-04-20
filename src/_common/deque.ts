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
    constructor(capacity?: number) {
        this.head = 0
        this.tail = 0
        this.cap = getCapacity(capacity)
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
    peekBack(): Option<T> {
        return this._peek(this.tail - 1)
    }
    getBack(): T {
        return this._get(this.tail - 1)
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
    peekFront(): Option<T> {
        return this._peek(this.head)
    }
    getFront(): T {
        return this._get(this.head)
    }
    peek(index: number): Option<T> {
        if (index >= 0 && index < this.length) {
            return this._peek(this.head + index)
        } else {
            return None
        }
    }
    get(index: number): T {
        if (index >= 0 && index < this.length) {
            return this._get(this.head + index)
        } else {
            throw new Error("invalid index")
        }
    }
    private _peek(index: number): Option<T> {
        if (this.isEmpty()) return None
        const idx = index & this.mask
        return Some(this.buf[idx]!)
    }
    private _get(index: number): T {
        if (this.isEmpty()) throw new Error("Deque.get")
        const idx = index & this.mask
        return this.buf[idx]!
    }
    static fromArray<R>(arr: R[]): Deque<R> {
        const deque = new Deque<R>(arr.length)
        arr.forEach((val) => deque.pushBack(val))
        return deque
    }
    toArray(): T[] {
        const ret = new Array<T>(this.length)
        for (let i = 0, len = this.length; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            ret[i] = item
        }
        return ret
    }
    *[Symbol.iterator]() {
        for (let i = 0, len = this.length; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            yield item
        }
    }
    forEach(fn: (value: T, index?: number) => unknown) {
        for (let i = 0, len = this.length; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            fn(item, i)
        }
    }
    map<R>(fn: (value: T, index?: number) => R): R[] {
        const ret = new Array<R>(this.length)
        for (let i = 0, len = this.length; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            ret[i] = fn(item, i)
        }
        return ret
    }
    filter(fn: (value: T, index?: number) => boolean): T[] {
        const ret: T[] = []
        for (let i = 0, len = this.length; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            if (fn(item, i)) ret.push(item)
        }
        return ret
    }
    some(fn: (value: T, index?: number) => boolean): boolean {
        for (let i = 0, len = this.length; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            if (fn(item, i)) return true
        }
        return false
    }
    every(fn: (value: T, index?: number) => boolean): boolean {
        for (let i = 0, len = this.length; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            if (!fn(item, i)) return false
        }
        return true
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

function getCapacity(capacity: number | undefined): number {
    if (typeof capacity !== "number") return 4
    if (capacity < 0) throw new Error("capacity must greater than 0")
    if (capacity > 1073741824)
        throw new Error("capacity must lesser than 2**31")
    return pow2AtLeast(Math.max(4, capacity))
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
