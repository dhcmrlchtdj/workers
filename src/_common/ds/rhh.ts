import { none, some, type Option } from "../option.ts"

const I_KEY = 0
const I_VAL = 1
const I_HASH = 2
const I_PSL = 3

const LOAD_FACTOR = 0.85
const MIN_CAPACITY = 8

export class RobinHood<K extends string | number, V> {
	private _growAt: number
	private _shrinkAt: number
	private _bucket: [key: K, value: V, hash: number, psl: number][]
	private _mask: number
	private _size: number
	private _hash: (k: K) => number
	constructor(options?: { capacity?: number; hash?: (k: K) => number }) {
		const capacity = pow2AtLeast(
			Math.max(MIN_CAPACITY, options?.capacity ?? MIN_CAPACITY),
		)
		this._growAt = (capacity * LOAD_FACTOR) | 0
		this._shrinkAt = (capacity * (1 - LOAD_FACTOR)) | 0
		this._bucket = new Array<[K, V, number, number]>(capacity)
		this._mask = capacity - 1
		this._size = 0
		this._hash = options?.hash ?? DEFAULT_HASH_FN
	}
	has(key: K): boolean {
		if (this._size === 0) return false
		const hash = this._hash(key)
		let pos = hash & this._mask
		while (true) {
			const e = this._bucket[pos]
			if (!e) return false
			if (e[I_HASH] === hash && e[I_KEY] === key) return true
			pos = (pos + 1) & this._mask
		}
	}
	get(key: K): Option<V> {
		if (this._size === 0) return none
		const hash = this._hash(key)
		let pos = hash & this._mask
		while (true) {
			const e = this._bucket[pos]
			if (!e) return none
			if (e[I_HASH] === hash && e[I_KEY] === key) return some(e[I_VAL])
			pos = (pos + 1) & this._mask
		}
	}
	set(key: K, value: V): Option<V> {
		const hash = this._hash(key)
		let pos = hash & this._mask
		let newEntry = [key, value, hash, 0] as [K, V, number, number]
		while (true) {
			const e = this._bucket[pos]
			// create new entry
			if (!e) {
				if (this._size >= this._growAt)
					this._resize(this._bucket.length + 1)
				this._bucket[pos] = newEntry
				this._size++
				return none
			}
			// replace value
			if (
				e[I_HASH] === newEntry[I_HASH] &&
				e[I_KEY] === newEntry[I_KEY]
			) {
				const replaced = some(e[I_VAL])
				e[I_VAL] = newEntry[I_VAL]
				return replaced
			}
			// swap
			if (e[I_PSL] < newEntry[I_PSL]) {
				this._bucket[pos] = newEntry
				newEntry = e
			}
			pos = (pos + 1) & this._mask
			newEntry[I_PSL] = newEntry[I_PSL] + 1
		}
	}
	delete(key: K): Option<V> {
		if (this._size === 0) return none
		const hash = this._hash(key)
		let pos = hash & this._mask
		while (true) {
			const e = this._bucket[pos]
			if (!e) return none
			if (e[I_HASH] === hash && e[I_KEY] === key) {
				const deleted = some(e[I_VAL])
				this._deleteAt(pos)
				return deleted
			}
			pos = (pos + 1) & this._mask
		}
	}
	private _deleteAt(pos: number) {
		let delPos = pos
		while (true) {
			const nextPos = (delPos + 1) & this._mask
			const next = this._bucket[nextPos]
			if (next) {
				if (next[I_PSL] === 0) {
					break
				} else {
					// backward shift
					this._bucket[delPos] = next
					next[I_PSL] = next[I_PSL] - 1
					delPos = nextPos
				}
			}
		}
		this._size--
		if (this._size >= MIN_CAPACITY && this._size <= this._shrinkAt) {
			this._resize(this._size)
		}
	}
	private _resize(size: number) {
		const newRHH = new RobinHood<K, V>({ capacity: size, hash: this._hash })
		for (const [k, v] of this.entries()) {
			newRHH.set(k, v)
		}
		this._growAt = newRHH._growAt
		this._shrinkAt = newRHH._shrinkAt
		this._bucket = newRHH._bucket
		this._mask = newRHH._mask
	}
	*keys(): IterableIterator<K> {
		for (let i = 0, len = this._bucket.length; i < len; i++) {
			const e = this._bucket[i]
			if (e) {
				yield e[I_KEY]
			}
		}
	}
	*values(): IterableIterator<V> {
		for (let i = 0, len = this._bucket.length; i < len; i++) {
			const e = this._bucket[i]
			if (e) {
				yield e[I_VAL]
			}
		}
	}
	*entries(): IterableIterator<[K, V]> {
		for (let i = 0, len = this._bucket.length; i < len; i++) {
			const e = this._bucket[i]
			if (e) {
				yield [e[I_KEY], e[I_VAL]]
			}
		}
	}
}

///

function DEFAULT_HASH_FN<K extends string | number>(key: K) {
	switch (typeof key) {
		case "string":
			return hashString(key)
		case "number":
			return hashNumber(key)
		default:
			throw new Error("hash: invalid key")
	}
}
// https://github.com/immutable-js/immutable-js/blob/v4.3.0/src/Hash.js
// MIT License
function hashNumber(n: number): number {
	if (n !== n || n === Infinity) {
		return 0
	}
	let hashed = n | 0
	if (hashed !== n) {
		hashed ^= n * 0xffffffff
	}
	while (n > 0xffffffff) {
		n /= 0xffffffff
		hashed ^= n
	}
	return hashed >>> 0
}
function hashString(s: string): number {
	let hashed = 0
	for (let i = 0, len = s.length; i < len; i++) {
		hashed = (31 * hashed + s.charCodeAt(i)) | 0
	}
	return hashed >>> 0
}

///

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
