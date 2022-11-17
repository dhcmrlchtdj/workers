class LinkedListNode<T> {
	elem: T
	prev: LinkedListNode<T>
	next: LinkedListNode<T>
	constructor(elem: T) {
		this.elem = elem
		// only head.prev and tail.next would be null
		// other node will be inserted into the LinkedList immediately
		this.prev = null!
		this.next = null!
	}
	pop() {
		const prev = this.prev
		const next = this.next
		prev.next = next
		next.prev = prev
	}
	insert(prev: LinkedListNode<T>, next: LinkedListNode<T>) {
		prev.next = this
		next.prev = this
		this.next = next
		this.prev = prev
	}
}
export class LinkedList<T> {
	head: LinkedListNode<T>
	tail: LinkedListNode<T>
	constructor() {
		this.head = new LinkedListNode(null as T)
		this.tail = new LinkedListNode(null as T)
		this.head.next = this.tail
		this.tail.prev = this.head
	}
	addFirst(elem: T): LinkedListNode<T> {
		const node = new LinkedListNode(elem)
		node.insert(this.head, this.head.next)
		return node
	}
	addLast(elem: T): LinkedListNode<T> {
		const node = new LinkedListNode(elem)
		node.insert(this.tail.prev, this.tail)
		return node
	}
	removeFirst(): LinkedListNode<T> {
		const node = this.head.next
		if (node === this.tail) {
			throw new Error("empty list")
		} else {
			node.pop()
			return node
		}
	}
	removeLast(): LinkedListNode<T> {
		const node = this.tail.prev
		if (node === this.head) {
			throw new Error("empty list")
		} else {
			node.pop()
			return node
		}
	}
	getFirst(): LinkedListNode<T> {
		const node = this.head.next
		if (node === this.tail) {
			throw new Error("empty list")
		} else {
			return node
		}
	}
	getLast(): LinkedListNode<T> {
		const node = this.tail.prev
		if (node === this.head) {
			throw new Error("empty list")
		} else {
			return node
		}
	}
	moveToFirst(node: LinkedListNode<T>) {
		node.pop()
		node.insert(this.head, this.head.next)
	}
	moveToLast(node: LinkedListNode<T>) {
		node.pop()
		node.insert(this.tail.prev, this.tail)
	}
}

class KV<K, V> {
	key: K
	value: V
	constructor(key: K, value: V) {
		this.key = key
		this.value = value
	}
}
export class LRU<K, V> {
	private capacity: number
	private map: Map<K, LinkedListNode<KV<K, V>>>
	private list: LinkedList<KV<K, V>>
	constructor(capacity: number) {
		this.capacity = capacity
		this.map = new Map()
		this.list = new LinkedList()
	}
	get(key: K): V | null {
		const item = this.map.get(key)
		if (!item) {
			return null
		}
		this.list.moveToFirst(item)
		return item.elem.value
	}
	set(key: K, value: V) {
		const item = this.map.get(key)
		if (item) {
			item.elem.value = value
			this.list.moveToFirst(item)
		} else {
			const newElem = new KV(key, value)
			const newNode = this.list.addFirst(newElem)
			if (this.map.size >= this.capacity) {
				const oldNode = this.list.removeLast()
				this.map.delete(oldNode.elem.key)
			}
			this.map.set(key, newNode)
		}
	}
}
