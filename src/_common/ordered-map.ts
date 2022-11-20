import { Option, Some, None } from "./option.js"

export class OrderedMap<K, V> {
	private map: Map<K, Entry<K, V>>
	private list: LinkedList<K, V>
	constructor() {
		this.map = new Map()
		this.list = new LinkedList()
	}
	size(): number {
		return this.map.size
	}
	getFirst(): Option<V> {
		if (this.map.size === 0) return None
		const e = this.list.getFirst()
		return Some(e.value)
	}
	removeFirst() {
		if (this.map.size === 0) return
		const e = this.list.removeFirst()
		this.map.delete(e.key)
	}
	addLast(key: K, value: V) {
		const e = this.map.get(key)
		if (e === undefined) {
			const e = new Entry(key, value)
			this.map.set(key, e)
			this.list.addLast(e)
		} else {
			e.value = value
			this.list.moveToLast(e)
		}
	}
	removeIf(fn: (key: K, value: V) => boolean) {
		for (const e of this.map.values()) {
			if (fn(e.key, e.value)) {
				this.map.delete(e.key)
				this.list.remove(e)
			}
		}
	}
}

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
	getFirst(): Entry<K, V> {
		return this.head.next
	}
	addLast(e: Entry<K, V>) {
		this.insert(e, this.tail.prev, this.tail)
	}
	removeFirst(): Entry<K, V> {
		const e = this.head.next
		this.remove(e)
		return e
	}
	moveToLast(e: Entry<K, V>) {
		this.remove(e)
		this.addLast(e)
	}
	remove(e: Entry<K, V>) {
		e.prev.next = e.next
		e.next.prev = e.prev
		e.prev = null!
		e.next = null!
	}
	private insert(e: Entry<K, V>, prev: Entry<K, V>, next: Entry<K, V>) {
		e.prev = prev
		prev.next = e
		e.next = next
		next.prev = e
	}
}
