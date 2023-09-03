import { type Option, some, none } from "../option.ts"

// credit
// https://doc.rust-lang.org/std/collections/struct.VecDeque.html
// https://github.com/petkaantonov/deque
export class Deque<T> {
	// front | ...[head]...[tail]... | back
	//    H       T
	// [. o o o o . . . ]
	private head: number // current head index, read
	private tail: number // current tail index, write
	private buf: T[]
	private cap: number // cap must to be power of two
	private mask: number
	constructor(capacity?: number) {
		this.head = 0
		this.tail = 0
		this.cap = getCapacity(capacity)
		this.mask = this.cap - 1
		this.buf = new Array<T>(this.cap)
	}

	private isEmpty(): boolean {
		return this.head === this.tail
	}
	private checkCapacity(size: number) {
		if (this.length + size >= this.cap) {
			this.growTo(this.length + size + 1)
		}
	}
	private inc(idx: number, n = 1): number {
		return (idx + n) & this.mask
	}
	private dec(idx: number, n = 1): number {
		return (idx - n + this.cap) & this.mask
	}
	private growTo(capacity: number) {
		const oldCap = this.cap
		const head = this.head
		const tail = this.tail

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
			const n = tail
			move(this.buf, n, 0, oldCap)
			this.tail = oldCap + n
		} else {
			//            T H
			// [o o o o o . o o ]
			//            T                 H
			// [o o o o o . . . . . . . . . o o ]
			const n = oldCap - head
			const newHead = this.cap - n
			move(this.buf, n, head, newHead)
			this.head = newHead
		}
	}

	get length(): number {
		return (this.tail - this.head + this.cap) & this.mask
	}

	pushBack(value: T) {
		this.checkCapacity(1)
		const idx = this.tail
		this.buf[idx] = value
		this.tail = this.inc(idx)
	}
	pushBackArray(arr: T[]) {
		const len = arr.length
		this.checkCapacity(len)
		const idx = this.tail
		for (let i = 0; i < len; i++) {
			this.buf[this.inc(idx, i)] = arr[i]!
		}
		this.tail = this.inc(idx, len)
	}
	popBack(): Option<T> {
		if (this.isEmpty()) {
			return none
		} else {
			const idx = this.dec(this.tail)
			const item = this.buf[idx]!
			// @ts-expect-error
			this.buf[idx] = undefined // cleanup
			this.tail = idx
			return some(item)
		}
	}
	peekBack(): Option<T> {
		return this._peek(this.tail)
	}
	getBack(): T {
		return this._get(this.tail)
	}

	pushFront(value: T) {
		this.checkCapacity(1)
		const idx = this.dec(this.head)
		this.buf[idx] = value
		this.head = idx
	}
	pushFrontArray(arr: T[]) {
		const len = arr.length
		this.checkCapacity(len)
		const idx = this.head - 1
		for (let i = 0; i < len; i++) {
			this.buf[this.dec(idx, i)] = arr[i]!
		}
		this.head = this.dec(this.head, len)
	}
	popFront(): Option<T> {
		if (this.isEmpty()) {
			return none
		} else {
			const idx = this.head
			const item = this.buf[idx]!
			// @ts-expect-error
			this.buf[idx] = undefined // cleanup
			this.head = this.inc(idx)
			return some(item)
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
			return this._peek(this.inc(this.head, index))
		} else {
			return none
		}
	}
	get(index: number): T {
		if (index >= 0 && index < this.length) {
			return this._get(this.inc(this.head, index))
		} else {
			throw new Error("invalid index")
		}
	}

	private _peek(index: number): Option<T> {
		if (this.isEmpty()) return none
		return some(this.buf[index]!)
	}
	private _get(index: number): T {
		if (this.isEmpty()) throw new Error("Deque.get")
		return this.buf[index]!
	}

	static fromArray<R>(arr: R[]): Deque<R> {
		const deque = new Deque<R>(arr.length)
		deque.pushBackArray(arr)
		return deque
	}
	toArray(): T[] {
		const ret: T[] = []
		for (let i = 0, len = this.length; i < len; i++) {
			const item = this.buf[this.inc(this.head, i)]!
			ret.push(item)
		}
		return ret
	}
	forEach(fn: (value: T, index?: number) => unknown) {
		for (let i = 0, len = this.length; i < len; i++) {
			const item = this.buf[this.inc(this.head, i)]!
			fn(item, i)
		}
	}
	map<R>(fn: (value: T, index?: number) => R): R[] {
		const ret: R[] = []
		for (let i = 0, len = this.length; i < len; i++) {
			const item = this.buf[this.inc(this.head, i)]!
			ret.push(fn(item, i))
		}
		return ret
	}
	filter(fn: (value: T, index?: number) => boolean): T[] {
		const ret: T[] = []
		for (let i = 0, len = this.length; i < len; i++) {
			const item = this.buf[this.inc(this.head, i)]!
			if (fn(item, i)) ret.push(item)
		}
		return ret
	}
	some(fn: (value: T, index?: number) => boolean): boolean {
		for (let i = 0, len = this.length; i < len; i++) {
			const item = this.buf[this.inc(this.head, i)]!
			if (fn(item, i)) return true
		}
		return false
	}
	every(fn: (value: T, index?: number) => boolean): boolean {
		for (let i = 0, len = this.length; i < len; i++) {
			const item = this.buf[this.inc(this.head, i)]!
			if (!fn(item, i)) return false
		}
		return true
	}
}

function move(target: unknown[], n: number, fromPos: number, toPos: number) {
	for (let i = 0; i < n; i++) {
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
