import { Option, Some, None } from "./option"

// credit
// https://doc.rust-lang.org/std/collections/struct.VecDeque.html
// https://github.com/petkaantonov/deque
export class Deque<T> {
    // front | ...[head]...[tail]... | back
    private head: number // current head index
    private len: number
    private buf: Array<T>
    private cap: number // cap must to be power of two
    private mask: number
    constructor(capacity?: number) {
        this.head = 0
        this.len = 0
        this.cap = getCapacity(capacity)
        this.mask = this.cap - 1
        this.buf = new Array(this.cap)
    }
    get length(): number {
        return this.len
    }
    private growTo(capacity: number) {
        const oldCap = this.cap
        const head = this.head
        const tail = (head + this.len) & this.mask

        this.cap = getCapacity(capacity)
        this.mask = this.cap - 1
        this.buf.length = this.cap

        if (head <= tail) {
            //  H             T
            // [o o o o o o o . ]
            //  H             T
            // [o o o o o o o . . . . . . . . . ]
        } else if (tail < oldCap - head) {
            //      T H
            // [o o . o o o o o ]
            //        H             T
            // [. . . o o o o o o o . . . . . . ]
            const size = tail
            move(this.buf, size, 0, oldCap)
        } else {
            //            T H
            // [o o o o o . o o ]
            //            T                 H
            // [o o o o o . . . . . . . . . o o ]
            const size = oldCap - head
            const newHead = this.cap - size
            move(this.buf, size, head, newHead)
            this.head = newHead
        }
    }
    pushBack(value: T) {
        if (this.len + 1 === this.cap) {
            this.growTo(this.len + 2)
        }
        const idx = (this.head + this.len) & this.mask
        this.buf[idx] = value
        this.len++
    }
    pushBackArray(arr: T[]) {
        if (this.len + arr.length >= this.cap) {
            this.growTo(this.len + arr.length + 1)
        }
        const idx = this.head + this.len
        for (let i = 0, len = arr.length; i < len; i++) {
            this.buf[(idx + i) % this.mask] = arr[i]!
        }
        this.len += arr.length
    }
    popBack(): Option<T> {
        if (this.len === 0) {
            return None
        } else {
            const idx = (this.head + this.len) & this.mask
            const item = this.buf[idx]!
            this.buf[idx] = undefined!
            this.len--
            return Some(item)
        }
    }
    peekBack(): Option<T> {
        return this._peek(this.head + this.len)
    }
    getBack(): T {
        return this._get(this.head + this.len)
    }
    pushFront(value: T) {
        if (this.len + 1 === this.cap) {
            this.growTo(this.cap + 2)
        }
        const idx = (this.head - 1 + this.cap) & this.mask
        this.head = idx
        this.buf[idx] = value
        this.len++
    }
    pushFrontArray(arr: T[]) {
        if (this.len + arr.length >= this.cap) {
            this.growTo(this.len + arr.length + 1)
        }
        let idx = this.head - 1
        for (let i = 0, len = arr.length; i < len; i++) {
            this.buf[(idx - i + this.cap) & this.mask] = arr[i]!
        }
        this.head = (this.head - arr.length + this.cap) & this.mask
        this.len += arr.length
    }
    popFront(): Option<T> {
        if (this.len === 0) {
            return None
        } else {
            const idx = this.head
            const item = this.buf[idx]!
            this.head = (this.head + 1) & this.mask
            this.buf[idx] = undefined!
            this.len--
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
        if (index >= 0 && index < this.len) {
            return this._peek(this.head + index)
        } else {
            return None
        }
    }
    get(index: number): T {
        if (index >= 0 && index < this.len) {
            return this._get(this.head + index)
        } else {
            throw new Error("invalid index")
        }
    }
    private _peek(index: number): Option<T> {
        if (this.len === 0) return None
        const idx = index & this.mask
        return Some(this.buf[idx]!)
    }
    private _get(index: number): T {
        if (this.len === 0) throw new Error("Deque.get")
        const idx = index & this.mask
        return this.buf[idx]!
    }
    static fromArray<R>(arr: R[]): Deque<R> {
        const deque = new Deque<R>(arr.length)
        deque.pushBackArray(arr)
        return deque
    }
    toArray(): T[] {
        const ret = new Array<T>(this.length)
        for (let i = 0, len = this.len; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            ret[i] = item
        }
        return ret
    }
    forEach(fn: (value: T, index?: number) => unknown) {
        for (let i = 0, len = this.len; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            fn(item, i)
        }
    }
    map<R>(fn: (value: T, index?: number) => R): R[] {
        const ret = new Array<R>(this.len)
        for (let i = 0, len = this.len; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            ret[i] = fn(item, i)
        }
        return ret
    }
    filter(fn: (value: T, index?: number) => boolean): T[] {
        const ret: T[] = []
        for (let i = 0, len = this.len; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            if (fn(item, i)) ret.push(item)
        }
        return ret
    }
    some(fn: (value: T, index?: number) => boolean): boolean {
        for (let i = 0, len = this.len; i < len; i++) {
            const item = this.buf[(this.head + i) & this.mask]!
            if (fn(item, i)) return true
        }
        return false
    }
    every(fn: (value: T, index?: number) => boolean): boolean {
        for (let i = 0, len = this.len; i < len; i++) {
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
    for (let i = 0; i < size; i++) {
        target[toPos + i] = target[fromPos + i]
        target[fromPos + i] = undefined
    }
}

function getCapacity(capacity: number | undefined): number {
    if (typeof capacity !== "number") return 4
    if (capacity < 0) throw new Error("capacity must greater than 0")
    if (capacity > 1073741824)
        throw new Error("capacity must lesser than 2**30")
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
