export class Entry<K, V> {
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

export class LinkedList<K, V> {
	private head: Entry<K, V>
	private tail: Entry<K, V>
	private size: number
	constructor() {
		const sentinel = new Entry(null, null) as Entry<K, V>
		sentinel.prev = sentinel
		sentinel.next = sentinel
		this.head = sentinel
		this.tail = sentinel
		this.size = 0
	}

	getFirst(): Entry<K, V> | undefined {
		if (this.size === 0) return undefined
		return this.head.next
	}
	getLast(): Entry<K, V> | undefined {
		if (this.size === 0) return undefined
		return this.tail.prev
	}

	private _add(e: Entry<K, V>, prev: Entry<K, V>, next: Entry<K, V>) {
		this.size++
		e.prev = prev
		prev.next = e
		e.next = next
		next.prev = e
	}
	addFirst(e: Entry<K, V>) {
		this._add(e, this.head, this.head.next)
	}
	addLast(e: Entry<K, V>) {
		this._add(e, this.tail.prev, this.tail)
	}

	remove(e: Entry<K, V>): Entry<K, V> {
		this.size--
		e.prev.next = e.next
		e.next.prev = e.prev
		e.prev = null!
		e.next = null!
		return e
	}
	removeFirst(): Entry<K, V> | undefined {
		if (this.size === 0) return undefined
		return this.remove(this.head.next)
	}
	removeLast(): Entry<K, V> | undefined {
		if (this.size === 0) return undefined
		return this.remove(this.tail.prev)
	}

	moveToFirst(e: Entry<K, V>) {
		this.remove(e)
		this.addFirst(e)
	}
	moveToLast(e: Entry<K, V>) {
		this.remove(e)
		this.addLast(e)
	}
}
