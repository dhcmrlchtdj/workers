import { LinkedList, Entry } from "./linked-list.js"
import { LinkedMap } from "./linked-map.js"
import { Option, Some, None } from "./option.js"

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface CachePolicy<K, V> {
	size(): number
	has(key: K): boolean
	peek(key: K): Option<V>
	get(key: K): Option<V>
	set(key: K, value: V): Option<V> // replaced value
	remove(key: K): Option<V> // removed value
	keys(): K[]
}

export class LRU<K, V> implements CachePolicy<K, V> {
	private capacity: number
	private map: Map<K, Entry<K, V>>
	private list: LinkedList<K, V>
	constructor(capacity: number) {
		this.capacity = capacity
		this.map = new Map()
		this.list = new LinkedList()
	}
	size(): number {
		return this.map.size
	}
	get(key: K): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			return None
		} else {
			this.list.moveToFirst(e)
			return Some(e.value)
		}
	}
	set(key: K, value: V): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			const e = new Entry(key, value)
			if (this.map.size >= this.capacity) {
				const old = this.list.removeLast()
				this.map.delete(old.key)
			}
			this.list.addFirst(e)
			this.map.set(key, e)
			return None
		} else {
			const replaced = Some(e.value)
			e.value = value
			this.list.moveToFirst(e)
			return replaced
		}
	}
	remove(key: K): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			return None
		} else {
			this.list.remove(e)
			this.map.delete(key)
			return Some(e.value)
		}
	}
	_removeLast(): Option<Entry<K, V>> {
		if (this.map.size === 0) return None
		const e = this.list.removeLast()
		this.map.delete(e.key)
		return Some(e)
	}
	has(key: K): boolean {
		return this.map.has(key)
	}
	peek(key: K): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			return None
		} else {
			return Some(e.value)
		}
	}
	keys(): K[] {
		return [...this.map.keys()]
	}
}

export class ARC<K, V> implements CachePolicy<K, V> {
	private capacity: number
	private p: number
	private recent: LRU<K, V> // T1
	private recentEvicted: LRU<K, null> // B1
	private frequent: LRU<K, V> // T2
	private frequentEvicted: LRU<K, null> // B2
	constructor(capacity: number) {
		this.capacity = capacity
		this.p = 0
		this.recent = new LRU(capacity)
		this.recentEvicted = new LRU(capacity)
		this.frequent = new LRU(capacity)
		this.frequentEvicted = new LRU(capacity)
	}
	size(): number {
		return this.recent.size() + this.frequent.size()
	}
	has(key: K): boolean {
		return this.frequent.has(key) || this.recent.has(key)
	}
	peek(key: K): Option<V> {
		const e = this.frequent.peek(key)
		if (e.isSome) return e
		return this.recent.peek(key)
	}
	get(key: K): Option<V> {
		const e = this.recent.remove(key)
		if (e.isSome) {
			this.frequent.set(key, e.unwrap())
			return e
		} else {
			return this.frequent.get(key)
		}
	}
	set(key: K, value: V): Option<V> {
		if (this.frequent.has(key)) {
			// case 1
			const replaced = this.frequent.set(key, value)
			return replaced
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
			const replaced = this._replace(false)
			this.recentEvicted.remove(key)
			this.frequent.set(key, value)
			return replaced
		} else if (this.frequentEvicted.has(key)) {
			// case 3
			const sizeF = this.frequentEvicted.size()
			const sizeR = this.recentEvicted.size()
			this.p = Math.max(
				0,
				this.p - Math.max(1, Math.floor(sizeR / sizeF)),
			)
			const replaced = this._replace(true)
			this.frequentEvicted.remove(key)
			this.frequent.set(key, value)
			return replaced
		} else {
			// case 4
			let replaced: Option<V> = None
			const recentSize = this.recent.size() + this.recentEvicted.size()
			const frequentSize =
				this.frequent.size() + this.frequentEvicted.size()
			if (recentSize === this.capacity) {
				// case 4.1
				if (this.recent.size() < this.capacity) {
					this.recentEvicted._removeLast()
					replaced = this._replace(false)
				} else {
					const e = this.recent._removeLast()
					replaced = e.map((e) => e.value)
				}
			} else if (recentSize + frequentSize >= this.capacity) {
				// case 4.2
				if (recentSize + frequentSize === this.capacity * 2) {
					this.frequentEvicted._removeLast()
				}
				replaced = this._replace(false)
			}
			this.recent.set(key, value)
			return replaced
		}
	}
	private _replace(hitFrequentEvicted: boolean): Option<V> {
		const sizeRecent = this.recent.size()
		const sizeFrequence = this.frequent.size()

		// have enough space
		if (sizeRecent + sizeFrequence < this.capacity) {
			return None
		}

		// replace recent
		if (sizeRecent > 0) {
			const needToDrop = sizeRecent > this.p
			const haveToDrop = sizeRecent === this.p && hitFrequentEvicted
			if (needToDrop || haveToDrop) {
				return this.recent._removeLast().map((e) => {
					this.recentEvicted.set(e.key, null)
					return e.value
				})
			}
		}

		// replace frequent
		return this.frequent._removeLast().map((e) => {
			this.frequentEvicted.set(e.key, null)
			return e.value
		})
	}
	remove(key: K): Option<V> {
		const removeF = this.frequent.remove(key)
		const removeR = this.recent.remove(key)
		this.frequentEvicted.remove(key)
		this.recentEvicted.remove(key)
		return removeF.isSome ? removeF : removeR
	}
	keys(): K[] {
		return [...this.frequent.keys(), ...this.recent.keys()]
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
		if (e.isSome) return e
		return this.recent.get(key)
	}
	get(key: K): Option<V> {
		const e = this.frequent.get(key)
		if (e.isSome) return e
		return this.recent.get(key)
	}
	set(key: K, value: V): Option<V> {
		if (this.frequent.has(key)) {
			return this.frequent.set(key, value)
		} else if (this.recent.has(key)) {
			return this.recent.update(key, value)
		} else if (this.ghost.has(key)) {
			this.ghost.remove(key)
			return this.frequent.set(key, value)
		} else {
			let replaced: Option<V> = None
			if (this.recent.size() === this.recentCapacity) {
				const e = this.recent.removeLast().unwrap()
				replaced = Some(e.value)
				if (this.ghost.size() === this.ghostCapacity) {
					this.ghost.removeLast()
				}
				this.ghost.addFirst(e.key, null)
			}
			this.recent.addFirst(key, value)
			return replaced
		}
	}
	remove(key: K): Option<V> {
		const removeF = this.frequent.remove(key)
		const removeR = this.recent.remove(key)
		this.ghost.remove(key)
		return removeF.isSome ? removeF : removeR
	}
	keys(): K[] {
		return [...this.frequent.keys(), ...this.recent.keys()]
	}
}
