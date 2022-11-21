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
