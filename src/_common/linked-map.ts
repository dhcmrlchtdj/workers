import { LinkedList, Entry } from "./linked-list.js"
import { Option, Some, None } from "./option.js"

export class LinkedMap<K, V> {
	private map: Map<K, Entry<K, V>>
	private list: LinkedList<K, V>
	constructor() {
		this.map = new Map()
		this.list = new LinkedList()
	}
	size(): number {
		return this.map.size
	}
	keys(): K[] {
		return [...this.map.keys()]
	}
	has(key: K): boolean {
		return this.map.has(key)
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
	get(key: K): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			return None
		} else {
			return Some(e.value)
		}
	}
	update(key: K, value: V): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			return None
		} else {
			const replaced = e.value
			e.value = value
			return Some(replaced)
		}
	}
	getFirst(): Option<V> {
		if (this.map.size === 0) return None
		const e = this.list.getFirst()
		return Some(e.value)
	}
	removeFirst(): Option<Entry<K, V>> {
		if (this.map.size === 0) return None
		const e = this.list.removeFirst()
		this.map.delete(e.key)
		return Some(e)
	}
	removeLast(): Option<Entry<K, V>> {
		if (this.map.size === 0) return None
		const e = this.list.removeLast()
		this.map.delete(e.key)
		return Some(e)
	}
	addFirst(key: K, value: V): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			const e = new Entry(key, value)
			this.map.set(key, e)
			this.list.addFirst(e)
			return None
		} else {
			const replaced = e.value
			e.value = value
			this.list.moveToFirst(e)
			return Some(replaced)
		}
	}
	addLast(key: K, value: V): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			const e = new Entry(key, value)
			this.map.set(key, e)
			this.list.addLast(e)
			return None
		} else {
			const replaced = e.value
			e.value = value
			this.list.moveToLast(e)
			return Some(replaced)
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
