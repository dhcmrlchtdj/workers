import { Option, Some, None } from "./option.js"

class Entry<K, V> {
	prev: Entry<K, V>
	next: Entry<K, V>
	key: K
	value: V
	constructor(key: K, value: V) {
		this.key = key
		this.value = value
		this.prev = null!
		this.next = null!
	}
}

class LinkedList<K, V> {
	head: Entry<K, V>
	tail: Entry<K, V>
	constructor() {
		const sentinel = new Entry(null, null) as Entry<K, V>
		sentinel.prev = sentinel
		sentinel.next = sentinel
		this.head = sentinel
		this.tail = sentinel
	}
	addFirst(e: Entry<K, V>) {
		this.insert(e, this.head, this.head.next)
	}
	removeLast(): Entry<K, V> {
		const last = this.tail.prev
		this.remove(last)
		return last
	}
	moveToFirst(e: Entry<K, V>) {
		this.remove(e)
		this.insert(e, this.head, this.head.next)
	}
	remove(e: Entry<K, V>) {
		e.prev.next = e.next
		e.next.prev = e.prev
	}
	insert(e: Entry<K, V>, prev: Entry<K, V>, next: Entry<K, V>) {
		e.prev = prev
		prev.next = e
		e.next = next
		next.prev = e
	}
}

export class LRU<K, V> {
	private capacity: number
	private map: Map<K, Entry<K, V>>
	private list: LinkedList<K, V>
	constructor(capacity: number) {
		this.capacity = capacity
		this.map = new Map()
		this.list = new LinkedList()
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
	// true, added
	// false, updated
	set(key: K, value: V): boolean {
		const e = this.map.get(key)
		if (e === undefined) {
			const e = new Entry(key, value)
			if (this.map.size >= this.capacity) {
				// remove lastest
				const old = this.list.removeLast()
				this.map.delete(old.key)
			}
			this.list.addFirst(e)
			this.map.set(key, e)
			return true
		} else {
			e.value = value
			this.list.moveToFirst(e)
			return false
		}
	}
	// true, removed
	// false, not exist
	remove(key: K): boolean {
		const e = this.map.get(key)
		if (e === undefined) {
			return false
		} else {
			this.list.remove(e)
			this.map.delete(key)
			return true
		}
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
	keys(): IterableIterator<K> {
		return this.map.keys()
	}
	size(): number {
		return this.map.size
	}
}
