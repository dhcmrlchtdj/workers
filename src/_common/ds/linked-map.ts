import { LinkedList, Entry } from "./linked-list.ts"
import { type Option, some, none } from "../option.ts"

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
	keys(): IterableIterator<K> {
		return this.map.keys()
	}
	has(key: K): boolean {
		return this.map.has(key)
	}

	get(key: K): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			return none
		} else {
			return some(e.value)
		}
	}
	getFirst(): Option<V> {
		if (this.map.size === 0) return none
		const e = this.list.getFirst()!
		return some(e.value)
	}
	getLast(): Option<V> {
		if (this.map.size === 0) return none
		const e = this.list.getLast()!
		return some(e.value)
	}

	remove(key: K): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			return none
		} else {
			this.map.delete(key)
			this.list.remove(e)
			return some(e.value)
		}
	}
	removeFirst(): Option<Entry<K, V>> {
		if (this.map.size === 0) return none
		const e = this.list.removeFirst()!
		this.map.delete(e.key)
		return some(e)
	}
	removeLast(): Option<Entry<K, V>> {
		if (this.map.size === 0) return none
		const e = this.list.removeLast()!
		this.map.delete(e.key)
		return some(e)
	}

	update(key: K, value: V): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			return none
		} else {
			const replaced = e.value
			e.value = value
			return some(replaced)
		}
	}
	addFirst(key: K, value: V): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			const e = new Entry(key, value)
			this.map.set(key, e)
			this.list.addFirst(e)
			return none
		} else {
			const replaced = e.value
			e.value = value
			this.list.moveToFirst(e)
			return some(replaced)
		}
	}
	addLast(key: K, value: V): Option<V> {
		const e = this.map.get(key)
		if (e === undefined) {
			const e = new Entry(key, value)
			this.map.set(key, e)
			this.list.addLast(e)
			return none
		} else {
			const replaced = e.value
			e.value = value
			this.list.moveToLast(e)
			return some(replaced)
		}
	}

	moveToFirst(key: K) {
		if (this.map.has(key)) {
			this.list.moveToFirst(this.map.get(key)!)
		}
	}
	moveToLast(key: K) {
		if (this.map.has(key)) {
			this.list.moveToLast(this.map.get(key)!)
		}
	}
}
