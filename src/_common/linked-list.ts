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
	getLast(): Entry<K, V> {
		return this.tail.prev
	}

	private _add(e: Entry<K, V>, prev: Entry<K, V>, next: Entry<K, V>) {
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

	removeFirst(): Entry<K, V> {
		const e = this.head.next
		this.remove(e)
		return e
	}
	removeLast(): Entry<K, V> {
		const e = this.tail.prev
		this.remove(e)
		return e
	}

	moveToFirst(e: Entry<K, V>) {
		this.remove(e)
		this.addFirst(e)
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
}
