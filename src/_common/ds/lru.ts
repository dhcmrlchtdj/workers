import { Entry } from "./linked-list.js"
import { LinkedMap } from "./linked-map.js"
import { type Option, none } from "../option.js"

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface CachePolicy<K, V> {
	size(): number
	has(key: K): boolean
	peek(key: K): Option<V>
	get(key: K): Option<V>
	set(key: K, value: V): Option<V> // replaced value
	remove(key: K): Option<V> // removed value
	keys(): IterableIterator<K>
}

export class LRU<K, V> implements CachePolicy<K, V> {
	private capacity: number
	private map: LinkedMap<K, V>
	constructor(capacity: number) {
		this.capacity = capacity
		this.map = new LinkedMap()
	}
	size(): number {
		return this.map.size()
	}
	keys(): IterableIterator<K> {
		return this.map.keys()
	}
	has(key: K): boolean {
		return this.map.has(key)
	}
	peek(key: K): Option<V> {
		return this.map.get(key)
	}
	get(key: K): Option<V> {
		const e = this.map.get(key)
		if (e.isSome()) {
			this.map.moveToFirst(key)
		}
		return e
	}
	set(key: K, value: V): Option<V> {
		const replaced = this.map.addFirst(key, value)
		if (this.map.size() > this.capacity) {
			this.map.removeLast()
		}
		return replaced
	}
	remove(key: K): Option<V> {
		return this.map.remove(key)
	}
	_removeLast(): Option<Entry<K, V>> {
		return this.map.removeLast()
	}
}

export class ARC<K, V> implements CachePolicy<K, V> {
	private capacity: number
	private p: number
	private recent: LinkedMap<K, V> // T1
	private recentEvicted: LinkedMap<K, null> // B1
	private frequent: LRU<K, V> // T2
	private frequentEvicted: LinkedMap<K, null> // B2
	constructor(capacity: number) {
		this.capacity = capacity
		this.p = 0
		this.recent = new LinkedMap()
		this.recentEvicted = new LinkedMap()
		this.frequent = new LRU(capacity)
		this.frequentEvicted = new LinkedMap()
	}
	size(): number {
		return this.recent.size() + this.frequent.size()
	}
	has(key: K): boolean {
		return this.frequent.has(key) || this.recent.has(key)
	}
	peek(key: K): Option<V> {
		const e = this.frequent.peek(key)
		if (e.isSome()) return e
		return this.recent.get(key)
	}
	get(key: K): Option<V> {
		const e = this.recent.remove(key)
		if (e.isSome()) {
			this.frequent.set(key, e.unwrap())
			return e
		} else {
			return this.frequent.get(key)
		}
	}
	set(key: K, value: V): Option<V> {
		if (this.frequent.has(key)) {
			// case 1
			return this.frequent.set(key, value)
		} else if (this.recent.has(key)) {
			// case 1
			const replaced = this.recent.remove(key)
			this.frequent.set(key, value)
			return replaced
		} else if (this.recentEvicted.has(key)) {
			// case 2
			const sizeF = this.frequentEvicted.size()
			const sizeR = this.recentEvicted.size()
			this.p = Math.min(
				this.capacity,
				this.p + Math.max(1, Math.floor(sizeF / sizeR)),
			)
			this._replace(false)
			this.recentEvicted.remove(key)
			this.frequent.set(key, value)
			return none
		} else if (this.frequentEvicted.has(key)) {
			// case 3
			const sizeF = this.frequentEvicted.size()
			const sizeR = this.recentEvicted.size()
			this.p = Math.max(
				0,
				this.p - Math.max(1, Math.floor(sizeR / sizeF)),
			)
			this._replace(true)
			this.frequentEvicted.remove(key)
			this.frequent.set(key, value)
			return none
		} else {
			// case 4
			const recentSize = this.recent.size() + this.recentEvicted.size()
			const frequentSize =
				this.frequent.size() + this.frequentEvicted.size()
			if (recentSize === this.capacity) {
				// case 4.1
				if (this.recent.size() < this.capacity) {
					this.recentEvicted.removeLast()
					this._replace(false)
				} else {
					this.recent.removeLast()
				}
			} else if (recentSize + frequentSize >= this.capacity) {
				// case 4.2
				if (recentSize + frequentSize === this.capacity * 2) {
					this.frequentEvicted.removeLast()
				}
				this._replace(false)
			}
			this.recent.addFirst(key, value)
			return none
		}
	}
	private _replace(hitFrequentEvicted: boolean): void {
		const sizeRecent = this.recent.size()
		const sizeFrequence = this.frequent.size()

		// have enough space
		if (sizeRecent + sizeFrequence < this.capacity) {
			return
		}

		// replace recent
		if (sizeRecent > 0) {
			const needToDrop = sizeRecent > this.p
			const haveToDrop = sizeRecent === this.p && hitFrequentEvicted
			if (needToDrop || haveToDrop) {
				const e = this.recent.removeLast().unwrap()
				this.recentEvicted.addFirst(e.key, null)
				if (this.recentEvicted.size() > this.capacity) {
					this.recentEvicted.removeLast()
				}
				return
			}
		}

		// replace frequent
		const e = this.frequent._removeLast().unwrap()
		this.frequentEvicted.addFirst(e.key, null)
		if (this.frequentEvicted.size() > this.capacity) {
			this.frequentEvicted.removeLast()
		}
	}
	remove(key: K): Option<V> {
		const removeF = this.frequent.remove(key)
		const removeR = this.recent.remove(key)
		this.frequentEvicted.remove(key)
		this.recentEvicted.remove(key)
		return removeF.isSome() ? removeF : removeR
	}
	*keys(): IterableIterator<K> {
		yield* this.frequent.keys()
		yield* this.recent.keys()
	}
}

export class TwoQueue<K, V> implements CachePolicy<K, V> {
	private frequentCapacity: number
	private recentCapacity: number
	private ghostCapacity: number
	private frequent: LRU<K, V> // Am
	private recent: LinkedMap<K, V> // A1in
	private ghost: LinkedMap<K, null> // A1out
	constructor(capacity: number, frequentRatio = 0.75, ghostRatio = 0.5) {
		this.frequentCapacity = Math.ceil(capacity * frequentRatio)
		this.recentCapacity = capacity - this.frequentCapacity
		this.ghostCapacity = Math.ceil(capacity * ghostRatio)
		this.frequent = new LRU(this.frequentCapacity)
		this.recent = new LinkedMap()
		this.ghost = new LinkedMap()
	}
	size(): number {
		return this.recent.size() + this.frequent.size()
	}
	has(key: K): boolean {
		return this.frequent.has(key) || this.recent.has(key)
	}
	peek(key: K): Option<V> {
		const e = this.frequent.peek(key)
		if (e.isSome()) return e
		return this.recent.get(key)
	}
	get(key: K): Option<V> {
		const e = this.frequent.get(key)
		if (e.isSome()) return e
		return this.recent.get(key)
	}
	set(key: K, value: V): Option<V> {
		if (this.frequent.has(key)) {
			return this.frequent.set(key, value)
		} else if (this.recent.has(key)) {
			return this.recent.update(key, value)
		} else if (this.ghost.has(key)) {
			this.ghost.remove(key)
			return none
		} else {
			this.recent.addFirst(key, value)
			if (this.recent.size() > this.recentCapacity) {
				const e = this.recent.removeLast().unwrap()
				this.ghost.addFirst(e.key, null)
				if (this.ghost.size() > this.ghostCapacity) {
					this.ghost.removeLast()
				}
			}
			return none
		}
	}
	remove(key: K): Option<V> {
		const removeF = this.frequent.remove(key)
		const removeR = this.recent.remove(key)
		this.ghost.remove(key)
		return removeF.isSome() ? removeF : removeR
	}
	*keys(): IterableIterator<K> {
		yield* this.frequent.keys()
		yield* this.recent.keys()
	}
}
